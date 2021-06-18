/*
 * Copyright (c) 2021 EdgerOS Team.
 * All rights reserved.
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * File: main.js.
 *
 * Author: hanhui@acoinfo.com
 *
 */

/* Import system modules */
const Device = require('device');
const WebApp = require('webapp');
const SyncTable = require('synctable');
const WebSyncTable = require('websynctable');
const permission = require('permission');
const faceai = require('./face');

/* Camera file */
const RECV_FILE = '/cam/pic.jpg';

/* Create App */
const app = WebApp.createApp();

/* Device */
const dev = new Device();

/* Set static path */
app.use(WebApp.static('./public'));

/**
 * Set main table
 */
var main = new SyncTable('main');

/**
 * Create main table server
 */
var server = new WebSyncTable(app, main);

/**
 * Last picture buffer
 */
var lastpic = undefined;

/*
 * Get picture
 */
async function recv(cipher, size) {
	return new Promise((resolve, rejects) => {
		var chunks = [];
		var connector = new Device.Connector(dev, cipher);

		console.log(`Recving picture... cipher: ${cipher}`);
		dev.send({ cmd: 'recv', connector, size });

		connector.on('timeout', function() {
			chunks = [];
			console.error('Timeout!');
		});

		connector.on('data', function(data) {
			chunks.push(data);
		});

		connector.on('error', function(error) {
			console.error('Connector error:', error);
		});

		connector.on('close', function() {
			console.log('Closed!');
			if (chunks.length) {
				var chunk = Buffer.concat(chunks);
				if (!size || chunk.length === size) {
					return resolve(chunk);
				}
			}
			rejects('Recv error!');
		});
	});
}

/**
 * Get pictrue
 */
server.on('recv', (msg, client, reply) => {
	if (dev.devid == undefined) {
		reply({ res: 'error', info: 'No device request!' });
		return;
	}

	recv(msg.cipher).then(chunk => {
		lastpic = chunk;
		reply({ res: 'ok', file: RECV_FILE, size: chunk.length });
	}).catch(error => {
		reply({ res: 'error', info: error.message });
	});
});

/**
 * Save person feature
 */
server.on('save', (msg, client, reply) => {
	if (lastpic == undefined) {
		reply({ res: 'error', info: 'No picture received!' });
		return;
	}

	var info = faceai.detect(lastpic);
	if (info == undefined) {
		reply({ res: 'error', info: 'No face detect!' });
	} else if (info.faces.length > 1) {
		reply({ res: 'error', info: 'Too many face detect!' });
	} else {
		var feature = faceai.feature(info.faces[0], info.bitmap);
		if (feature) {
			faceai.save(msg.name, feature);
			reply({ res: 'ok' });
		} else {
			reply({ res: 'error', info: 'Facial features are not obvious!' });
		}
	}
});

/**
 * Remove person feature
 */
server.on('remove', (msg, client, reply) => {
	faceai.remove(msg.name);
	reply({ res: 'ok' });
});

/**
 * Device message
 */
dev.on('message', function(msg) {
	if (msg && msg.cmd === 'recv' && msg.size > 0) {
		recv(false, msg.size).then(chunk => {
			lastpic  = chunk;
			var name = undefined;
			var info = faceai.detect(lastpic);
			if (info) {
				for (var face of info.faces) {
					var feature = faceai.feature(face, info.bitmap);
					if (feature) {
						name = faceai.best(feature);
						if (name) {
							dev.send({ cmd: 'unlock', timeout: 5000 });
						}
						break;
					}
				}
			} else {
				console.log('No face detect!');
			}
			server.reverse('recv', { file: RECV_FILE, name });
		}).catch(error => console.error(error));
	}
});

/**
 * Get picture
 */
app.get(RECV_FILE, function(req, res) {
	if (lastpic) {
		res.setHeader('Content-Type', 'image/jpeg');
		res.end(lastpic);
	} else {
		res.status(404).send('Not found!');
	}
});

/* Request */
function request(devid) {
	if (dev.devid == undefined) {
		dev.request(devid, function(error) {
			if (error) {
				console.error('Request device error:', error);
			} else {
				console.info(`Device ${devid} request ok!`);
			}
		});
	}
}

/* Device Join */
Device.on('join', function(devid, info) {
	if (info.report.name === 'IoT Camera') {
		request(devid);
	}
});

/* Device list */
async function devlist() {
	return new Promise(resolve => {
		Device.list(true, (error, list) => {
			resolve(error ? [] : list);
		});
	});
}

/* Device info */
async function devinfo(devid) {
	return new Promise(resolve => {
		Device.info(devid, (error, info) => {
			resolve(error ? undefined : info);
		});
	});
}

/* Request Iot Camera */
async function devreq() {
	var list = await devlist();
	for (var device of list) {
		var info = await devinfo(device.devid);
		if (info && info.report.name === 'IoT Camera') {
			request(device.devid);
			break;
		}
	}
}

/* Permission changed */
permission.update(function(perm) {
	console.info('Permission changed!');
	if (perm.devices.length || perm.alldev) {
		if (dev.devid == undefined) {
			devreq().then(() => {}, console.error);
		}
	}
});

/* Try request exist device */
devreq().then(() => {}, console.error);

/* Start App */
app.start();

/* Event loop */
require('iosched').forever();
