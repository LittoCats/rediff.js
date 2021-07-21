/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : 星期三 7月 21, 2021 11:52:08 CST
 *
 * @description : index
 *
 ******************************************************************************/

export interface Comparable<T>
{
  compare(other: Comparable<T>): -1 | 0 | 1;
}

export type List<T extends Comparable<any>> = Array<T>;

function Comparator<T extends Comparable<any>>(left: T, right: T) { return left.compare(right); }

export enum Status
{
  Matched = 1,
  NoMatch = -1,
  Unknown = -2
}

export class State
{
  private static BAD_INDEX = -1;
  private _start: number = State.BAD_INDEX;
  private _length: number = Status.Unknown;

  public get start() { return this._start; }
  public get end() { return this._start + this._length - 1; }

  public get length() {
    return this._length > 0 ? this._length : this._length === 0 ? 1 : 0;
  }

  public get status() {
    return this._length > 0 ? Status.Matched :
      this._length === -1 ? Status.NoMatch :
        (console.assert(this._length === -2,
          'Invalid status: _length < -2'), Status.Unknown);
  }

  protected setUnknown() {
    this._start = State.BAD_INDEX;
    this._length = Status.Unknown;
  }

  public setMatched(start: number, length: number)
  {
    console.assert(length > 0, 'Length must be greater than zero');
    console.assert(start >= 0, 'Start must be greater than or equal to zero');
    this._start = start;
    this._length = length;
  }

  public setNoMatch()
  {
    this._start = State.BAD_INDEX;
    this._length = Status.NoMatch;
  }

  public hasValidLength(start: number, end: number, maxPossibleDestLength: number)
  {
    if (this._length > 0 && ((
      maxPossibleDestLength < this._length
    ) || (
      (this.start < start) || (this.end > end)
    ))) this.setUnknown();
    return this._length !== Status.Unknown;
  }
}

enum ResultStatus
{
  NoChange,
  Replace,
  Delete,
  Insert
}

export class Result implements Comparable<Result>
{
  public static Status = ResultStatus;
  public static BAD_INDEX = -1;

  private readonly _dest: number;
  private readonly _source: number;
  private _length: number;
  private readonly _status: ResultStatus;

  public get destIndex() { return this._dest; }
  public get sourceIndex() { return this._source; }
  public get length() { return this._length; }
  public get status() { return this._status; }

  private constructor(status: ResultStatus,
                     destIndex: number,
                     sourceIndex: number,
                     length: number)
  {
    this._status = status;
    this._dest = destIndex;
    this._source = sourceIndex;
    this._length = length;
  }

  public static NoChange(destIndex: number,
                         sourceIndex: number,
                         length: number)
  {
    return new Result(ResultStatus.NoChange, destIndex, sourceIndex, length);
  }

  public static Replace(destIndex: number,
                        sourceIndex: number,
                        length: number)
  {
    return new Result(ResultStatus.Replace, destIndex, sourceIndex, length);
  }

  public static Delete(sourceIndex: number,
                       length = 0)
  {
    return new Result(ResultStatus.Delete, Result.BAD_INDEX, sourceIndex, length);
  }

  public static Insert(destIndex: number,
                       length = 0)
  {
    return new Result(ResultStatus.Insert, destIndex, Result.BAD_INDEX, length);
  }

  public addLength(delta: number)
  {
    this._length += delta;
  }

  public compare(other: Result): -1 | 0 | 1 {
    const thisIndex = this._dest;
    const otherIndex = other._dest;
    return thisIndex > otherIndex ? 1 : thisIndex < otherIndex ? -1 : 0;
  }

  public toString()
  {
    return `${ResultStatus[this._status]} (Dest: ${this._dest}, Source: ${this._source}) ${this._length}`;
  }
}

/** ************************************************************************ **/

enum Level {
  Fastest,
  Medium,
  Perfect
}

export class Engine<T extends Comparable<any>>
{
  private _level: Level = Level.Fastest;
  private _source: List<T> | null = null;
  private _dest: List<T> | null = null;
  private _matches: List<Result> | null = null;
  private _states: State[] | null = null;

  public get level() { return this._level; }
  public get source() { return this._source; }
  public get dest() { return this._dest; }
  public get matches() { return this._matches; }
  public get states() { return this._states; }

  public process(source: List<T>, destination: List<T>, level?: Level)
  {
    if (undefined !== level) this._level = level;
    const dt = Date.now();

    this._source = source;
    this._dest = destination;
    this._matches = [];

    const dcount = this._dest.length;
    const scount = this._source.length;

    if (dcount > 0 && scount > 0) {
      this._states = [];
      ProcessRange(this, 0, dcount - 1, 0, scount - 1);
    }

    const ts = Date.now() - dt;
    return ts/1000;
  }

  public report()
  {
    console.assert(
      this._states !== null &&
      this._dest !== null &&
      this._matches !== null,
      'engine.process must be call first.'
    );

    const retval: List<Result> = [];
    const dcount = this._dest!.length;
    const scount = this._source!.length;

    //Deal with the special case of empty files
    if (dcount == 0) {
      if (scount > 0) {
        retval.push(Result.Delete(0, scount));
      }
      return retval;
    } else {
      if (scount == 0) {
        retval.push(Result.Insert(0, dcount));
        return retval;
      }
    }


    this._matches!.sort(Comparator);
    let curDest = 0,
      curSource = 0;
    let last: Result | null = null;

    //Process each match record
    for (const drs of this._matches!) {
      if (!AddChanges(retval, curDest, drs.destIndex, curSource, drs.sourceIndex)
        && (last != null)
      ) {
        last.addLength(drs.length);
      } else {
        retval.push(drs);
      }
      curDest = drs.destIndex + drs.length;
      curSource = drs.sourceIndex + drs.length;
      last = drs;
    }

    //Process any tail end data
    AddChanges(retval,curDest,dcount,curSource,scount);

    return retval;
  }
}

export function GetSourceMatchLength<T extends Comparable<any>>(
  engine: Engine<T>,
  destIndex: number,
  sourceIndex: number,
  maxLength: number
) {
  const {dest: _dest, source: _source} = engine;
  let matchCount = 0;
  while (matchCount < maxLength) {
    if ( _dest![destIndex + matchCount].compare(_source![sourceIndex + matchCount]) != 0 )
      break;
    matchCount++;
  }
  return matchCount;
}

export function GetLongestSourceMatch<T extends Comparable<any>>(
  engine: Engine<T>,
  state: State,
  destIndex: number,
  destEnd: number,
  sourceStart: number,
  sourceEnd: number
) {
  const maxDestLength = (destEnd - destIndex) + 1;
  let curLength = 0,
    curBestLength = 0,
    curBestIndex = -1,
    maxLength = 0;

  for (let sourceIndex = sourceStart; sourceIndex <= sourceEnd; sourceIndex++) {
    maxLength = Math.min(maxDestLength,(sourceEnd - sourceIndex) + 1);
    if (maxLength <= curBestLength) {
      //No chance to find a longer one any more
      break;
    }
    curLength = GetSourceMatchLength(engine, destIndex,sourceIndex,maxLength);
    if (curLength > curBestLength) {
      //This is the best match so far
      curBestIndex = sourceIndex;
      curBestLength = curLength;
    }
    //jump over the match
    sourceIndex += curBestLength;
  }

  if (curBestIndex == -1) {
    state.setNoMatch();
  } else {
    state.setMatched(curBestIndex, curBestLength);
  }
}

function ProcessRange<T extends Comparable<any>>(
  engine: Engine<T>,
  destStart: number,
  destEnd: number,
  sourceStart: number,
  sourceEnd: number
) {
  let curBestIndex = -1,
    curBestLength = -1,
    maxPossibleDestLength = 0;
  let curItem: State | null = null,
    bestItem: State | null = null;

  for (let destIndex = destStart; destIndex <= destEnd; destIndex++) {
    maxPossibleDestLength = (destEnd - destIndex) + 1;
    if (maxPossibleDestLength <= curBestLength) {
      //we won't find a longer one even if we looked
      break;
    }
    curItem = GetStateAtIndex(engine, destIndex);

    if (!curItem.hasValidLength(sourceStart, sourceEnd, maxPossibleDestLength)) {
      //recalc new best length since it isn't valid or has never been done.
      GetLongestSourceMatch(engine, curItem, destIndex, destEnd, sourceStart, sourceEnd);
    }
    if (curItem.status == Status.Matched) {
      switch (engine.level) {
        case Level.Fastest:
          if (curItem.length> curBestLength) {
            //this is longest match so far
            curBestIndex = destIndex;
            curBestLength = curItem.length;
            bestItem = curItem;
          }
          //Jump over the match
          destIndex += curItem.length - 1;
          break;
        case Level.Medium:
          if (curItem.length> curBestLength) {
            //this is longest match so far
            curBestIndex = destIndex;
            curBestLength = curItem.length;
            bestItem = curItem;
            //Jump over the match
            destIndex += curItem.length- 1;
          }
          break;
        default:
          if (curItem.length > curBestLength) {
            //this is longest match so far
            curBestIndex = destIndex;
            curBestLength = curItem.length;
            bestItem = curItem;
          }
          break;
      }
    }
  }
  if (curBestIndex < 0) {
    //we are done - there are no matches in this span
  } else {
    const sourceIndex = bestItem!.start;
    engine.matches!.push(Result.NoChange(curBestIndex,sourceIndex,curBestLength));
    if (destStart < curBestIndex) {
      //Still have more lower destination data
      if (sourceStart < sourceIndex) {
        //Still have more lower source data
        // Recursive call to process lower indexes
        ProcessRange(engine, destStart, curBestIndex -1,sourceStart, sourceIndex -1);
      }
    }
    const upperDestStart = curBestIndex + curBestLength;
    const upperSourceStart = sourceIndex + curBestLength;
    if (destEnd > upperDestStart) {
      //we still have more upper dest data
      if (sourceEnd > upperSourceStart) {
        //set still have more upper source data
        // Recursive call to process upper indexes
        ProcessRange(engine, upperDestStart,destEnd,upperSourceStart,sourceEnd);
      }
    }
  }
}

function GetStateAtIndex<T extends Comparable<any>>(engine: Engine<T>, index: number)
{
  let state = engine.states![index];
  if (!state) state = engine.states![index] = new State();
  return state;
}

function AddChanges(
  report: List<Result>,
  curDest: number,
  nextDest: number,
  curSource: number,
  nextSource: number
): boolean {
  let retval = false;
  const diffDest = nextDest - curDest,
    diffSource = nextSource - curSource;
  let minDiff = 0;

  if (diffDest > 0) {
    if (diffSource > 0) {
      minDiff = Math.min(diffDest, diffSource);
      report.push(Result.Replace(curDest, curSource, minDiff));
      if (diffDest > diffSource) {
        curDest += minDiff;
        report.push(Result.Insert(curDest,diffDest - diffSource));
      } else {
        if (diffSource > diffDest) {
          curSource += minDiff;
          report.push(Result.Delete(curSource,diffSource - diffDest));
        }
      }
    } else {
      report.push(Result.Insert(curDest, diffDest));
    }

    retval = true;
  } else {
    if (diffSource > 0) {
      report.push(Result.Delete(curSource, diffSource));
      retval = true;
    }
  }

  return retval;
}
