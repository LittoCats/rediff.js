/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : 星期三 7月 21, 2021 16:36:22 CST
 *
 * @description : engine.spec
 *
 ******************************************************************************/

import { Engine } from "../index";

beforeAll(()=> {
  String.prototype.compare = String.prototype.compare || function(o) {
    return this > o ? 1 : this < o ? -1 : 0;
  };
});

describe(Engine, ()=> {
  it("should ", function() {
    const engine = new Engine();
    engine.process(
      'Once we find a sequence, first we slide the window down to where we are, since we won\'t be needing any of the previous characters any more.'.split(/[^a-z']+/ig),
      'Once we find a sequence, first we slide the window down to where we are, since we will not be needing any of the previous characters any more.'.split(/[^a-z]+/ig),
    );
    console.log(engine.report());
  });
});

