'use strict';

class ConsoleLogColors {
  constructor() {
    this._reset = "\x1b[0m";
    this._bright = "\x1b[1m";
    this._dim = "\x1b[2m";

    this._black = "\x1b[30m";
    this._red = "\x1b[31m";
    this._green = "\x1b[32m";
    this._yellow = "\x1b[33m";
    this._blue = "\x1b[34m";
    this._magenta = "\x1b[35m";
    this._cyan = "\x1b[36m";
    this._white = "\x1b[37m";

    this._BGblack = "\x1b[40m";
    this._BGred = "\x1b[41m";
    this._BGgreen = "\x1b[42m";
    this._BGyellow = "\x1b[43m";
    this._BGblue = "\x1b[44m";
    this._BGmagenta = "\x1b[45m";
    this._BGcyan = "\x1b[46m";
    this._BGwhite = "\x1b[47m";
  }

  _out(colorCode = "", txt = "") {
    console.log(colorCode + txt + this._reset);
  }

  ln() {
    this._out();
  }

  command(txt) {
    this._out(this._magenta, txt); //magenta
  }

  info(txt) {
    this._out(this._cyan, txt); //cyan
  }

  warn(txt) {
    this._out(this._yellow, txt); //yellow
  }

  error(txt) {
    this._out(this._BGred + this._white, txt); // white red
  }

  success(txt) {
    this._out(this._green, txt); // green
  }

  failure(txt) {
    this._out(this._bright + this._red, txt); // red
  }

}

module.exports = {
  ConsoleLogColors
};
