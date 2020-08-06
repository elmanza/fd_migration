var rp = require('request-promise');

const DISTANCE_BOX = {
	lat: {
		min: 25.2167,
		max: 50
	},
	lng: {
		min: -52,
		max: -124
	}
}

const distance = (lat1, lat2, lon1, lon2, unit="K") => {
	lat1 = formatPostion("lat", lat1)
	lat2 = formatPostion("lat", lat2)
	lon1 = formatPostion("lng", lon1)
	lon2 = formatPostion("lng", lon2)

	if ((lat1 == lat2) && (lon1 == lon2)) {
		return 0;
	}
	else {
		var radlat1 = Math.PI * lat1/180;
		var radlat2 = Math.PI * lat2/180;
		var theta = lon1-lon2;
		var radtheta = Math.PI * theta/180;
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
		if (dist > 1) {
			dist = 1;
		}
		dist = Math.acos(dist);
		dist = dist * 180/Math.PI;
		dist = dist * 60 * 1.1515;

		return dist;
	}
}

const formatPostion = (type, value) => {
	if (type === 'lat'){
		if (value > DISTANCE_BOX.lat.max) return value / 10
	}else {
		if (value < DISTANCE_BOX.lng.max) return value / 10
	}

	return value
}

module.exports = {
	distance
}
