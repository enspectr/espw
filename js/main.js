'use strict';

(() => {

const bgColor = window.getComputedStyle(document.body, null).getPropertyValue('background-color');
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let timeWnd = urlParams.get('wnd');
if (timeWnd < 10)
	timeWnd = 61;

const plot_color   = 'rgb(128, 128, 128)';
const signal_color = 'rgb(150, 200, 250)';
const x_margin     = 16;
const plot_width   = .85;
const plot_aspect  = .3;

const bt_connect = document.getElementById('connect');
const bt_devname = document.getElementById('devname');

const build_val = document.getElementById('build_date-val');

const bt_svc_id  = 0xFFE0;
const bt_char_id = 0xFFE1;
let   bt_char    = null;
let   bt_msg_buf = '';

let   plot_active = true;

const crc8_table = [
	0x00,  0x07,  0x0e,  0x09,  0x1c,  0x1b,  0x12,  0x15,  0x38,  0x3f,  0x36,  0x31,  0x24,  0x23,  0x2a,  0x2d, 
	0x70,  0x77,  0x7e,  0x79,  0x6c,  0x6b,  0x62,  0x65,  0x48,  0x4f,  0x46,  0x41,  0x54,  0x53,  0x5a,  0x5d, 
	0xe0,  0xe7,  0xee,  0xe9,  0xfc,  0xfb,  0xf2,  0xf5,  0xd8,  0xdf,  0xd6,  0xd1,  0xc4,  0xc3,  0xca,  0xcd, 
	0x90,  0x97,  0x9e,  0x99,  0x8c,  0x8b,  0x82,  0x85,  0xa8,  0xaf,  0xa6,  0xa1,  0xb4,  0xb3,  0xba,  0xbd, 
	0xc7,  0xc0,  0xc9,  0xce,  0xdb,  0xdc,  0xd5,  0xd2,  0xff,  0xf8,  0xf1,  0xf6,  0xe3,  0xe4,  0xed,  0xea, 
	0xb7,  0xb0,  0xb9,  0xbe,  0xab,  0xac,  0xa5,  0xa2,  0x8f,  0x88,  0x81,  0x86,  0x93,  0x94,  0x9d,  0x9a, 
	0x27,  0x20,  0x29,  0x2e,  0x3b,  0x3c,  0x35,  0x32,  0x1f,  0x18,  0x11,  0x16,  0x03,  0x04,  0x0d,  0x0a, 
	0x57,  0x50,  0x59,  0x5e,  0x4b,  0x4c,  0x45,  0x42,  0x6f,  0x68,  0x61,  0x66,  0x73,  0x74,  0x7d,  0x7a, 
	0x89,  0x8e,  0x87,  0x80,  0x95,  0x92,  0x9b,  0x9c,  0xb1,  0xb6,  0xbf,  0xb8,  0xad,  0xaa,  0xa3,  0xa4, 
	0xf9,  0xfe,  0xf7,  0xf0,  0xe5,  0xe2,  0xeb,  0xec,  0xc1,  0xc6,  0xcf,  0xc8,  0xdd,  0xda,  0xd3,  0xd4, 
	0x69,  0x6e,  0x67,  0x60,  0x75,  0x72,  0x7b,  0x7c,  0x51,  0x56,  0x5f,  0x58,  0x4d,  0x4a,  0x43,  0x44, 
	0x19,  0x1e,  0x17,  0x10,  0x05,  0x02,  0x0b,  0x0c,  0x21,  0x26,  0x2f,  0x28,  0x3d,  0x3a,  0x33,  0x34, 
	0x4e,  0x49,  0x40,  0x47,  0x52,  0x55,  0x5c,  0x5b,  0x76,  0x71,  0x78,  0x7f,  0x6a,  0x6d,  0x64,  0x63, 
	0x3e,  0x39,  0x30,  0x37,  0x22,  0x25,  0x2c,  0x2b,  0x06,  0x01,  0x08,  0x0f,  0x1a,  0x1d,  0x14,  0x13, 
	0xae,  0xa9,  0xa0,  0xa7,  0xb2,  0xb5,  0xbc,  0xbb,  0x96,  0x91,  0x98,  0x9f,  0x8a,  0x8d,  0x84,  0x83, 
	0xde,  0xd9,  0xd0,  0xd7,  0xc2,  0xc5,  0xcc,  0xcb,  0xe6,  0xe1,  0xe8,  0xef,  0xfa,  0xfd,  0xf4,  0xf3, 
];

function crc8(str)
{
	let crc = 0;
	for (let i = 0; i < str.length; ++i) {
		crc ^= str.charCodeAt(i);
		crc = crc8_table[crc];
	}
	return crc;
}

function isConnected()
{
	return bt_char !== null;
}

function setClickable(el, txt, cb)
{
	el.onclick = cb;
	el.classList.add('clickable');
	el.textContent = txt;
}

function resetClickable(el, txt)
{
	el.onclick = null;
	el.classList.remove('clickable');
	el.textContent = txt;	
}

const month_names = {
	1: 'Jan',
	2: 'Feb',
	3: 'Mar',
	4: 'Apr',
	5: 'May',
	6: 'Jun',
	7: 'Jul',
	8: 'Aug',
	9: 'Sep',
	10: 'Oct',
	11: 'Nov',
	12: 'Dec',
};

function build_info(val)
{
	const year  = 2024 + val/512|0;
	const month = (val%512)/32|0;
	const day   = val%32|0;
	return month_names[month] + day + ' ' + year;
}

function mk_handler(id)
{
	let elem = document.getElementById(id);
	return (val) => { elem.textContent = val; }
}

const monitoring_handlers = {
	'D' : (val) => { build_val.textContent = build_info(val); },
	'iV' : mk_handler('inp_mv-val'),
};

function mk_plot(name, samples, y_min = 0, y_max = null)
{
	let width  = (window.innerWidth  - x_margin) * plot_width;
	let height = width * plot_aspect;
	let xconf = { grid: false, label: null, domain: [0, timeWnd] };
	let yconf = { grid: true,  label: null };
	if (y_max !== null)
		yconf.domain = [y_min, y_max];
	return Plot.plot({
		marks: [
			Plot.areaY(samples, {
				x: 't',
				y1: 'y',
				y2: y_min,
				fill: signal_color,
			}),
			Plot.text([[0, y_min]], {
				text: [name],
				textAnchor: "start", dx: 20, dy: -10
			}),
		],
		x: xconf, y: yconf,
		width: width,
		height: height,
		style: {
			backgroundColor: bgColor,
			color: plot_color
		},
	});
}

function mk_plot_handler(id, title, units, vmin = 0, vmax = null)
{
	let samples = [];
	const plot_elem = document.getElementById(id);
	const val_elem  = document.getElementById(id + '-val');
	return (val) => {
		// Update samples
		const v = val / 1000;
		const now = Date.now() / 1000;
		const keep = now - timeWnd;
		while (samples.length && samples[samples.length-1].ts < keep)
			samples.pop()
		for (let i = 0; i < samples.length; ++i)
			samples[i].t = now - samples[i].ts;
		samples.unshift({ts: now, t: 0, y: v});
		// Update plot
		const plot = mk_plot(title, samples, vmin, vmax);
		const currPlot = plot_elem.firstChild;
		if (currPlot === null)
			plot_elem.appendChild(plot);
		else
			plot_elem.replaceChild(plot, currPlot);
		val_elem.textContent = v.toFixed(v >= 10 ? 2 : 3) + units;
	}
}

const plot_handlers = {
	'iV' : mk_plot_handler('inp_plot', 'Input', 'V')
};

function initPage()
{
	if (!navigator.bluetooth) {
		document.body.innerHTML = '<div class="alert-page">The Bluetooth is not supported in this browser. Please try another one.</div>';
		return;
	}
	setClickable(bt_connect, 'connect', onConnect);
}

function handleMessage(msg)
{
	for (const tag of msg.split(',')) {
		const kv = tag.split(':');
		const base = kv[0].length <= 1 ? 16 : 10;
		const val = parseInt(kv[1], base);
		if (kv[0] in monitoring_handlers)
			monitoring_handlers[kv[0]](val);
		if (plot_active && kv[0] in plot_handlers)
			plot_handlers[kv[0]](val);
	}
}

function onMessage(msg)
{
	console.log('rx:', msg);
	const crc = parseInt(msg.slice(-3, -1), 16);
	if (crc != crc8(msg.slice(1, -3))) {
		console.log('bad checksum');
		return;
	}

	handleMessage(msg.slice(3, -5));
}

function onValueChanged(event)
{
	const value = event.target.value;
	let msg = '';
	for (let i = 0; i < value.byteLength; i++) {
		const c = value.getUint8(i);
		if (c == 0)
			break;
		msg += String.fromCharCode(c);
	}
	if (!msg.length)
		return;
	if (bt_msg_buf == '' && (msg[1] != '#' || msg[2] != '#'))
		// ignore invalid message
		return;
	bt_msg_buf += msg;
	if (msg[msg.length-1] == '\r') {
		onMessage(bt_msg_buf);
		bt_msg_buf = '';
	}
}

function onDisconnection(event)
{
	const device = event.target;
	console.log(device.name + ' bluetooth device disconnected');
	bt_char = null;
	resetClickable(bt_connect, 'reconnecting')
	connectTo(device);
}

function onBTConnected(device, characteristic)
{
	console.log(device.name, 'connected');
	characteristic.addEventListener('characteristicvaluechanged', onValueChanged);
	device.addEventListener('gattserverdisconnected', onDisconnection);
	bt_char = characteristic;
	resetClickable(bt_connect, 'connected')
}

function connectTo(device)
{
	bt_devname.textContent = device.name;
	device.gatt.connect().
	then((server) => {
		console.log(device.name, 'GATT server connected, getting service...');
		return server.getPrimaryService(bt_svc_id);
	}).
	then((service) => {
		console.log(device.name, 'service found, getting characteristic...');
		return service.getCharacteristic(bt_char_id);
	}).
	then((characteristic) => {
		console.log(device.name, 'characteristic found');
		return characteristic.startNotifications().then(
			() => {
				onBTConnected(device, characteristic);
	        },
	        (err) => {
	        	console.log('Failed to subscribe to ' + device.name + ':', err.message);
	        	return Promise.reject(err);
	        }
        );
	})
	.catch((err) => {
		console.log('Failed to connect to ' + device.name + ':', err.message);
		setTimeout(() => { connectTo(device); }, 500);
		resetClickable(bt_connect, 'reconnecting')
	});
}

function doConnect(devname)
{
	console.log('doConnect', devname);
	resetClickable(bt_connect, 'connecting')
	let filters = [{services: [bt_svc_id]}];
	if (devname) {
		filters.push({name: devname});
	}
	return navigator.bluetooth.requestDevice({
		filters: filters,
	}).
	then((device) => {
		console.log(device.name, 'selected');
		connectTo(device);
	})
	.catch((err) => {
		console.log('Failed to discover BT devices');
		setClickable(bt_connect, 'connect', onConnect)
	});
}

function onConnect(event)
{
	console.log('onConnect');
	doConnect();
}

initPage();

})();

