/*
 * Copyright (c) 2021 EdgerOS Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: face.js.
 *
 * Author: hanhui@acoinfo.com
 *
 */

const facenn = require('facenn');
const LightKV = require('lightkv');
const imagecodec = require('imagecodec');

/* Face detection confidence rate */
const DETECT_CONFIDENCE_RATE = 0.8;

/* Face recognition confidence rate */
const RECONGNITION_CONFIDENCE_RATE = 0.6;

/* Face living body confidence rate */
const LIVING_BODY_CONFIDENCE_RATE = 0.4;

/* Face Database class */
class FaceDatabase {
	constructor() {
		this.lkv = new LightKV('./faces.lkv', 'c+', LightKV.OBJECT);
		this.map = this.lkv.toMap();
	}

	save(key, feature) {
		this.map.set(key, feature);
		this.lkv.set(key, feature);
	}

	remove(key) {
		this.lkv.delete(key);
		this.map.delete(key);
	}
}

/* Face Database class */
var facedb = new FaceDatabase();

/*
 * Detect
 */
function detect(picture) {
	try {
		var bitmap = imagecodec.decode(picture, {
			components: imagecodec.COMPONENTS_RGB
		});
		if (bitmap == undefined) {
			throw new Error('Unknown picture format!');
		}
		var faces = facenn.detect(bitmap.buffer, {
						width: bitmap.width, 
						height: bitmap.height, 
						pixelFormat: facenn.PIX_FMT_RGB24
					}, true);
		if (faces) {
			for (var i = 0; i < faces.length; i++) {
				if (faces[i].score < DETECT_CONFIDENCE_RATE) {
					faces.splice(i, 1);
					i--;
				}
			}
			if (faces.length) {
				console.log('Detect face num:', faces.length);
				return { faces, bitmap };
			}
		}
	} catch (error) {
		console.error('Image decode error', error);
	}
	return undefined;
}

/*
 * Get feature
 */
function feature(face, bitmap) {
	var feature = facenn.feature(bitmap.buffer, {
					width: bitmap.width, 
					height: bitmap.height, 
					pixelFormat: facenn.PIX_FMT_RGB24
				}, face, { live: true });
	if (feature.live < LIVING_BODY_CONFIDENCE_RATE) {
		console.log('No live:', feature.live);
		return undefined;
	} else {
		return feature.keys;
	}
}

/*
 * Search
 */
function search(feature) {
	var iter = facedb.map[Symbol.iterator]();
	for (var item of iter) {
		var same = facenn.compare(feature, item[1]);
		if (same >= RECONGNITION_CONFIDENCE_RATE) {
			console.info('Detect face:', item[0]);
			return item[0];
		} else {
			console.log('No same with', item[0], 'same level', same);
		}
	}
	return undefined;
}

/*
 * Best
 */
function best(feature) {
	var iter = facedb.map[Symbol.iterator]();
	var name = undefined;
	var near = 0;
	for (var item of iter) {
		var same = facenn.compare(feature, item[1]);
		if (same > near) {
			near = same;
			name = item[0];
		}
	}
	if (name) {
		console.info('Best mach with:', name, 'prob:', near);
	}
	return near >= RECONGNITION_CONFIDENCE_RATE ? name : undefined;
}

/*
 * Save feature
 */
function save(name, feature) {
	facedb.save(name, feature);
}

/*
 * Remove feature
 */
function remove(name) {
	facedb.remove(name);
}

/*
 * Exports
 */
module.exports.detect = detect;
module.exports.feature = feature;
module.exports.search = search;
module.exports.best = best;
module.exports.save = save;
module.exports.remove = remove;