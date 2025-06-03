guestDisplay: {
			name: 'Director: Guest Blind',
			description: 'Toggle whether a specific guest can see any video or not',
			options: [
				{
					type: 'textinput',
					label: 'Guest (position or stream ID)',
					id: 'target',
					default: '1',
				},
			],
			callback: (action) => {
				this.sendRequest('display', action.options.target)
			},


        }


		guestAltSoloChat: {
			name: 'Director: Two-way Solo Talk',
			description: 'Toggle two-way solo chat with a specific guest',
			options: [
				{
					type: 'textinput',
					label: 'Guest (position or stream ID)',
					id: 'target',
					default: '1',
				},
			],
			callback: (action) => {
				this.sendRequest('soloChatBidirectional', action.options.target, null)
			},
		},


        		guestForceKeyframe: {
			name: 'Director: Force Keyframe',
			description: 'Helps resolve rainbow puke',
			options: [
				{
					type: 'textinput',
					label: 'Guest (position or stream ID)',
					id: 'target',
					default: '1',
				},
			],
			callback: (action) => {
				this.sendRequest('forceKeyframe', action.options.target)
			},
		},




		forceKeyframe: {
			name: 'Local: Force Keyframe',
			description: 'Forces the publisher of a stream to issue keyframes to all viewers',
			options: [],
			callback: () => {
				this.sendRequest('forceKeyframe')
			},
		},


        		reload: {
			name: 'Local: Reload',
			description: 'Reload the current page',
			options: [],
			callback: () => {
				this.sendRequest('reload')
			},
		},



		{
    "action": "share-link",
    "value": "https://vdo.rpxl.app/?view=hr3RRzt"
}



{
    "action": "view-connection-info",
    "value": {
        "label": "RPXL-F92M60",
        "meta": false,
        "order": false,
        "muted": false,
        "queued": false,
        "directorSpeakerMuted": null,
        "directorDisplayMuted": null,
        "directorVideoMuted": false,
        "directorMirror": false,
        "video_muted_init": false,
        "room_init": true,
        "broadcast_mode": false,
        "remote": false,
        "allowdrawing": false,
        "obs_control": false,
        "screenshare_url": false,
        "screenShareState": false,
        "width_url": false,
        "height_url": false,
        "video_init_width": 1280,
        "video_init_height": 720,
        "video_init_frameRate": 60,
        "quality_url": 1,
        "maxvb_url": false,
        "maxviewers_url": false,
        "stereo_url": false,
        "aec_url": null,
        "agc_url": false,
        "denoise_url": false,
        "isolation_url": null,
        "version": "27.4",
        "recording_audio_gain": false,
        "recording_audio_compressor_type": false,
        "recording_audio_mic_delay": false,
        "recording_audio_ctx_latency": false,
        "recording_audio_pipeline": true,
        "playback_audio_pipeline": true,
        "playback_audio_samplerate": false,
        "playback_audio_volume_meter": false,
        "rotate_video": false,
        "useragent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "platform": "MacIntel",
        "gpGPU": "ANGLE (Intel, ANGLE Metal Renderer: Intel(R) UHD Graphics 630, Unspecified Version)",
        "CPU": "8 threads",
        "Browser": "Chromium-based v136",
        "power_level": 65,
        "plugged_in": true
    },
    "UUID": "382c73baf9b94213977c6bc13741c6b7",
    "streamID": "Stream_F92M60"
}