# RPXL

After a bit of frustration with the usual meeting software we created our own for the admittedly niche user case of online video approvals using the vdo ninja sdk.

It runs in browser and allows you to send two video streams, one high quality (up to 16Mbps) and one low quality user stream (typically limited to 60Kbs).

A lot of this functionality could be done in vdoninja using two separate frames and some URL flags, but RPXL packages it into a simple easy to use front end with a few extras.

Everything is run peer - to - peer, once the initial STUN / TURN handshake is done, no connecting to a central host or sending to the mother ship.

It's free to use, no limits on session duration, resolution, number of users or any of that. No signups or registration, no monthly fees.

## Install

Nothing to instal, runs through the browser but will need to acces to your media devices.
You will need a UVC device (search your electronic store of joice, they're normally fairly cheap) or use software like ndi tools or OBS studio to run a virtual camera.
Can be run on a separate machine if you want to offload encoding.

See the [help](https://rpxl.app/stream/help.html) for details.

## Security

It’s secure, WebRTC with mandatory SCTP/DTLS encryption over https.

## Usage

Use [https://rpxl.app/stream](https://rpxl.app/stream) to setup your streams, links shares etc.

Streams sources can be changed any time during the session, in fact nearly all parameters can be changed during the session.

Clients can change their devices, username at any time and have a very simple interface. Minimal clutter and easy to use tools such as :
 - Text chats, nothing fancy no emojis or gifs but URLs are recognized
 - File transfers, direct peer to peer no central host
 - Markups, simple drawing over main by any users

## Contributing

This project is based largely on the excellent work done by [Steve Seguin](https://github.com/steveseguin) and his [VDO Ninja project](https://vdo.ninja)

