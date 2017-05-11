'use strict';
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const request = require('request');
const Stream = require('stream');
const minmax = require('stumble/lib/gutil').minmax;
const fs = require('fs');
const radio = require('./radio.js');
const youtube = require('./youtube.js');
const Streamer = require('./streamer.js');
const {
    min,
    max
} = require('./utils.js')

const volumedown = {
    handle: "volumedown",
    exec: function(data) {
        let gain = this.io.input ? this.io.input.gain : this.config.extensions.audio.gain;
        gain = max(0.01, gain - 0.02);
        if (this.io.input) {
            this.io.input.setGain(gain);
        }
        this.config.extensions.audio.gain = gain;
        this.execute('info::gain');
    }
};
const volumeup = {
    handle: "volumeup",
    exec: function(data) {
        let gain = this.io.input ? this.io.input.gain : this.config.extensions.audio.gain;
        gain = min(1, gain + 0.02);
        if (this.io.input) {
            this.io.input.setGain(gain);
        }
        this.config.extensions.audio.gain = gain;
        this.execute('info::gain');
    }
};
const pause = {
    handle: "pause",
    exec: function(data) {
        if (this.io.input) this.io.input.pause()
    }
}
const resume = {
    handle: "play",
    exec: function(data) {
        if (this.io.input) this.io.input.resume()
    }
}
const clearBuffer = {
    handle: "clear-buffer",
    exec: function(data) {
        if (this.io.input) this.io.input.clearBuffer()
    }
}
const info = {
    handle: "messageinfo",
    extensions: [{
        handle: "info::gain",
        exec: function(data) {
            let gain = this.config.extensions.audio.gain
            if (this.io.input)
                gain = this.io.input.gain;
            this.client.user.channel.sendMessage("Current volume: " + (gain * 1000).toFixed(2));
        }
    }]
}


const reboot = {
    handle: "reboot",
    exec: _ => process.exit(0)
}

module.exports = {
    handle: 'streaming',
    needs: ['parser'],
    init: stumble => {
        stumble.space.set("streaming.nextVideo", []);
        stumble.space.set("streamer", new Streamer(stumble))
    },
    term: stumble => {},
    extensions: [info, youtube],
    commands: [radio, volumeup, volumedown, pause, resume, clearBuffer, reboot]
};
