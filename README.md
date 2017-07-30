# Who is Jeanne ?
[![Code Climate](https://codeclimate.com/github/TinyMan/node-jeanne/badges/gpa.svg)](https://codeclimate.com/github/TinyMan/node-jeanne)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/TinyMan/node-jeanne/issues)

Jeanne is meant to be a powerful Music bot for Mumble, with voice recognition. She can stream youtube video and (web)radio, with features like on-the-fly playlist and auto-playing.

Table of Contents
=================

   * [Who is Jeanne ?](#who-is-jeanne-)
   * [How does she work ?](#how-does-she-work-)
   * [How to use her ?](#how-to-use-her-)
      * [Commands](#commands)
      * [Radios](#radios)
   * [Setup](#setup)
      * [Running at startup](#running-at-startup)
   * [Todo](#todo)


# How does she work ?
Jeanne uses Google Speech API (old version) to get transcripts of your whispers. She then matches them against a set of commands. You can also type those commands to her.

Currently, the only language supported is french, but it should be simple to add new ones with your pull requests !

Jeanne is based on [Stumble](https://github.com/Okahyphen/stumble). She uses:
* [node-mumble](https://github.com/tinyman/node-mumble)
* [google-speech](https://github.com/TinyMan/google-speech)
* [youtube-node](https://github.com/nodenica/youtube-node)
* [node-ytdl-code](https://github.com/fent/node-ytdl-core)
* [node-fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
* ... and couple others

# How to use her ?
## Commands
Please see the wiki [commands page](https://github.com/TinyMan/node-jeanne/wiki/Commands).

## Radios
The list of radio currently available is:
```
Radio Kawa, Bim Team Radio, Nova, franceinfo, France Inter, France Musique, Skyrock, Oui FM, France Musique Classique easy, France Musique Classique plus, France Musique Concerts de Radio France, France Musique Musiques du monde - Ocora, France Musique La Jazz, France Musique La Contemporaine, France Culture, FIP (national), FIP à Nantes, FIP à Bordeaux, FIP à Strasbourg, FIP autour du rock, FIP autour du jazz, FIP autour du groove, FIP autour du monde, Tout nouveau, tout FIP, Mouv’, Mouv’ Xtra, France Bleu Alsace, France Bleu Armorique, France Bleu Auxerre, France Bleu Azur, France Bleu Béarn , France Bleu Belfort-Montbéliard, France Bleu Berry, France Bleu Besançon, France Bleu Bourgogne, France Bleu Breizh Izel, France Bleu Champagne-Ardenne, France Bleu Cotentin, France Bleu Creuse, France Bleu Drôme Ardèche, France Bleu Elsass, France Bleu Gard Lozère, France Bleu Gascogne, France Bleu Gironde, France Bleu Hérault, France Bleu Isère, France Bleu La Rochelle, France Bleu Limousin, France Bleu Loire Océan, France Bleu Lorraine Nord, France Bleu Maine, France Bleu Mayenne, France Bleu Nord, France Bleu Normandie (Calvados – Orne), France Bleu Normandie (Seine-Maritime – Eure), France Bleu Orléans, France Bleu Paris, France Bleu Pays d’Auvergne, France Bleu Pays de Savoie, France Bleu Pays Basque, France Bleu Perigord, France Bleu Picardie, France Bleu Poitou, France Bleu Provence, France Bleu RCFM Frequenza Mora, France Bleu Roussillon, France Bleu Saint-Étienne-Loire, France Bleu Sud Lorraine, France Bleu Toulouse, France Bleu Touraine, France Bleu Vaucluse, RFI Monde, RFI Afrique, BFM, Canal FM, Canal Sud, Chérie FM, Europe 1, Evasion FM, Flor FM, Fréquence3, Gold Fréquence3, Urban Fréquence3, Fréquence Plus, Gold FM, Jazz Radio, Kiss FM Dance, Magic Radio, Nostalgie, NRJ, Oceane FM, 100% Radio, Radio 6, Radio Bonne Nouvelle, Radio Bruaysis, Radio Campus Rennes, Radio Emotion, Radio Galaxie, Radio Menergy, Radio Scoop, Radio Scoop 91.3, Radio Scoop 98.8, Radio Scoop 89.2, Radio Scoop 100% Années 80, Radio Scoop 100% Music Pod, Radio Scoop 100% Powerdance, Radio Scoop 100% Salon du Mariage, RFM, RFM Collector, RFM Night Fever, Rire et Chansons, RMC, Toulouse FM, Virgin Radio, Virgin Radio Classics, Virgin Radio New, Virgin Radio Electro Shock, Virgin Radio Hit, Virgin Radio Rock, Vitamine
```
You can easily add radios by editing the file `data/radios.json`

# Setup
Since Jeanne uses [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), you have to install `ffmpeg`. If you have some troubles please follow the instructions at https://github.com/fluent-ffmpeg/node-fluent-ffmpeg#usage

Start by cloning the repo and installing the package:
```
git clone https://github.com/TinyMan/node-jeanne.git
cd node-jeanne
npm i
```

Then, you need API-keys for youtube and google-speech (https://github.com/gillesdemey/google-speech-v2). They should be placed in `keys/api-keys.json`. The file should look like this:
```json
{
    "youtube": "your-key-here",
    "google-speech": "your-key-here"
}
```

After that you need to edit your config file (`data/config.json`). You should only modify the server part and the default channel (extensions>info>movement>home)

You can test that she runs and connects to your server by running `node index.js`

## Running at startup
### On debian-base linux:
For that you need to install `forever`:
```
npm i -g forever
```

Then simply edit the file `jeanne` and replace the paths with yours:
```bash
...
pidFile="<jeanne path>/jeanne.pid"
logFile="<jeanne path>/jeanne.log"

command="node"
nodeApp="<jeanne path>/index.js"
foreverApp="forever"

...
```
Move the script to `/etc/init.d/jeanne` and run
```
update-rc.d jeanne defaults
```
To uninstall run
```
update-rc.d -f jeanne remove
```
# Todo
* Wiki
* Add languages
