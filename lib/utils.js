class BreakException {
    constructor(command, transcript) {
        this.command = command;
        this.transcript = transcript;
    }
};

function min(a, b) {
    return a < b ? a : b;
}

function max(a, b) {
    return a > b ? a : b;
}

module.exports = {
    BreakException,
    min,
    max
}
