'use strict';
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const request = require('request');
const Stream = require('stream');
const minmax = require('stumble/lib/gutil').minmax;
const fs = require('fs');
const radio = require('./radio.js');
const {
    youtube,
    ytstop,
    ytnext,
    add,
    addnext
} = require('./youtube.js');
const {
    min,
    max
} = require('./utils.js')

const playstream = {
    handle: "audio::playstream",
    exec: function playstream(data) {
        if (this.io.input) return false;
        else {
            const conf = this.config.extensions.audio;
            const samples = 48000;

            this.space.set('audio.streaming', true);

            this.io.establish({
                input: true,
                inputOptions: {
                    channels: 2,
                    sampleRate: samples,
                    gain: minmax(0.01, conf.gain, 1.0)
                }
            });

            const pass = new Stream.PassThrough();
            // ffmpeg's PassThrough is missing an unpipe method.
            // (╯ರ ~ ರ）╯︵ ┻━┻
            // Another pipe ought to fix it.

            ffmpeg(data.stream)
                .withAudioBitrate(data.format.bitrate)
                .withAudioFrequency(samples)
                .withAudioChannels(2)
                .format('s16le')
                .on('error', function(err, stdout, stderr) {
                    console.log('an error happened: ' + err.message);
                    console.log("ffmpeg stdout:\n" + stdout);
                    console.log("ffmpeg stderr:\n" + stderr);
                })
                .pipe(pass);

            let lived = true;

            pass
                .on('end', () => {
                    console.log('Stream ended')
                    if (lived) setTimeout(() => {
                        this.execute('audio::stopfile');

                        if (data.done) data.done(null, lived);
                    }, 250);
                })
                .on('kill', () => {
                    lived = false;
                    console.error("The playback was killed")
                    if (data.done) data.done({
                        code: 'APKILL',
                        message: 'Audio playback was killed.',
                    }, lived);

                    pass.end();
                })
                .pipe(this.io.input);

            this.space.set('audio.pass', pass);
        }


        return true;
    }
};

const baisse = {
    handle: "baisse",
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
const monte = {
    handle: "monte",
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

const info = {
    handle: "messageinfo",
    extensions: [{
        handle: "info::gain",
        exec: function(data) {
            let gain = this.config.extensions.audio.gain
            if (this.io.input)
                gain = this.io.input.gain;
            this.client.user.channel.sendMessage("Current volume: " + (gain * 100).toFixed(2) + "%");
        }
    }, {
        handle: "info::playing",
        exec: function(data) {
            let link = "https://youtu.be/" + data.item.id.videoId;
            let message = "Now playing <b>" + data.item.snippet.title + "</b> (<a href=\"" + link + "\">" + link + "</a>)";

            this.client.user.channel.sendMessage(message);
        }

    }, {
        handle: "info::next",
        exec: function(data) {
            let message = "Suivante: <b>" + data.terms + "</b>";

            this.client.user.channel.sendMessage(message);
        }
    }, {
        handle: "info::added",
        exec: function(data) {
            let message = "La video <b>" + data.terms + "</b> a été ajoutée à la playlist.";

            this.client.user.channel.sendMessage(message);
        }
    }]
}


const reboot = {
    handle: "reboot",
    exec: function() {

        process.exit(0);

    }
}

module.exports = {
    handle: 'streaming',
    needs: ['audio', 'parser'],
    init: stumble => {
        stumble.space.set("streaming.nextVideo", []);
    },
    term: stumble => {},
    extensions: [playstream, info],
    commands: [radio, youtube, ytstop, ytnext, add, addnext, monte, baisse, reboot]
};
