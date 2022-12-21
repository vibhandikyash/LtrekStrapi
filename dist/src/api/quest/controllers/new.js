"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request");
exports.default = ({ strapi }) => ({
    async index(ctx) {
        const { lat, lng, rad } = ctx.request.query;
        const query = await strapi.db.connection.raw(`SELECT *,ST_DistanceSphere(ST_MakePoint(longitude,latitude), ST_MakePoint(${lng},${lat})) AS air_distance FROM locations WHERE ST_DistanceSphere(ST_MakePoint(longitude,latitude), ST_MakePoint(${lng},${lat})) <= ${rad} * 1000 ORDER BY air_distance`);
        const payload = {
            lat: lat,
            lng: lng,
            lat1: 23.0146,
            lng1: 72.5306,
            bearing: 0,
        };
        var data = await getDirectionDataFromGoogle(payload);
        if (!["routes"]) {
            return data;
        }
        var p0 = {
            lat: payload.lat,
            lng: payload.lng, // Longitude
        };
        // return data['routes'][0]['legs'][0]['steps'].length;
        var p1 = null;
        if (data["routes"][0]["legs"][0]["steps"].length == 1) {
            p1 = {
                lat: data["routes"][0]["legs"][0]["steps"][0]["end_location"]["lat"],
                lng: data["routes"][0]["legs"][0]["steps"][0]["end_location"]["lng"], // Longitude
            };
        }
        else {
            p1 = {
                lat: data["routes"][0]["legs"][0]["steps"][1]["start_location"]["lat"],
                lng: data["routes"][0]["legs"][0]["steps"][1]["start_location"]["lng"], // Longitude
            };
        }
        // return p0;
        var angle = 0;
        if (data["routes"][0]["legs"][0]["steps"].length > 1) {
            p1 = {
                lat: data["routes"][0]["legs"][0]["steps"][1]["start_location"]["lat"],
                lng: data["routes"][0]["legs"][0]["steps"][1]["start_location"]["lng"], // Longitude
            };
            var p2 = {
                lat: data["routes"][0]["legs"][0]["steps"][1]["end_location"]["lat"],
                lng: data["routes"][0]["legs"][0]["steps"][1]["end_location"]["lng"], // Longitude
            };
            angle = Math.round(angleFromCoordinate(p1.lat, p1.lng, p2.lat, p2.lng));
        }
        // return p1;
        var rel_lat = p1.lat - p0.lat;
        var rel_lng = p0.lng - p1.lng;
        var d = calcCrow(p0.lat, p0.lng, p1.lat, p1.lng);
        var s = calcCrow(p0.lat, p0.lng, p1.lat, p0.lng);
        if (rel_lat < 0) {
            s = s * -1;
        }
        var o = calcCrow(p1.lat, p1.lng, p1.lat, p0.lng);
        if (rel_lng < 0) {
            o = o * -1;
        }
        var bearing = payload.bearing;
        var maneuver = "Head";
        var html_instructions = "NO Instruction";
        if (data["routes"][0]["legs"][0]["steps"].length == 1) {
            maneuver = "Distination";
            html_instructions = "You Reached at your Destination";
        }
        else {
            if (data["routes"][0]["legs"][0]["steps"][1]["maneuver"]) {
                maneuver = data["routes"][0]["legs"][0]["steps"][1]["maneuver"];
                html_instructions =
                    data["routes"][0]["legs"][0]["steps"][1]["html_instructions"];
            }
        }
        const waypoints = query.rows;
        var xy_waypoint = [];
        for (let waypoint of waypoints) {
            var p0 = {
                lat: payload.lat,
                lng: payload.lng, // Longitude
            };
            var p1 = {
                lat: waypoint["latitude"],
                lng: waypoint["longitude"], // Longitude
            };
            var pos1 = toOS(p0, p1, payload.bearing, waypoint);
            xy_waypoint.push(pos1);
        }
        xy_waypoint = xy_waypoint.sort((a, b) => parseFloat(a.d) - parseFloat(b.d));
        if (bearing == 0) {
            return {
                count: query.rowCount,
                rows: query.rows,
                xy_waypoint,
                z: s,
                X: o,
                d: d,
                lat: p1.lat,
                lng: p1.lng,
                maneuver: maneuver,
                html_instructions: html_instructions,
                angle: angle,
            };
        }
        bearing = (bearing * Math.PI) / 180;
        return {
            rows: query.rows,
            z: s,
            X: o,
            d: d,
            lat: p1.lat,
            lng: p1.lng,
            maneuver: maneuver,
            html_instructions: html_instructions,
            angle: angle,
        };
        function angleFromCoordinate(lat1, lon1, lat2, lon2) {
            var dLon = lon2 - lon1;
            var y = Math.sin(dLon) * Math.cos(lat2);
            var x = Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            var brng = Math.atan2(y, x);
            brng = toDegrees(brng);
            brng = (brng + 360) % 360;
            brng = 360 - brng; // count degrees counter-clockwise - remove to make clockwise
            return brng;
        }
        function toDegrees(angle) {
            return angle * (180 / Math.PI);
        }
        function toOS(p0, p1, bearing, waypoint) {
            var rel_lat = p1.lat - p0.lat;
            var rel_lng = p0.lng - p1.lng;
            var d = calcCrow(p0.lat, p0.lng, p1.lat, p1.lng);
            var s = calcCrow(p0.lat, p0.lng, p1.lat, p0.lng);
            if (rel_lat < 0) {
                s = s * -1;
            }
            var o = calcCrow(p1.lat, p1.lng, p1.lat, p0.lng);
            if (rel_lng < 0) {
                o = o * -1;
            }
            if (bearing == 0) {
                return {
                    z: s,
                    X: o,
                    d: d,
                    lat: waypoint.lat,
                    lng: waypoint.lng,
                    name: waypoint.name,
                    image: waypoint.image,
                    rating: waypoint.rating,
                    open_time: waypoint.open_time,
                    category: waypoint.category,
                    id: waypoint.id,
                    angle: waypoint.waypoint_id,
                };
            }
            bearing = (bearing * Math.PI) / 180;
            return {
                z: s * Math.cos(bearing) + o * Math.sin(bearing),
                X: -(s * Math.sin(bearing)) + o * Math.cos(bearing),
                d: d,
                lat: waypoint.lat,
                lng: waypoint.lng,
                name: waypoint.name,
                image: waypoint.image,
                rating: waypoint.rating,
                open_time: waypoint.open_time,
                category: waypoint.category,
                id: waypoint.id,
                angle: waypoint.waypoint_id,
            };
        }
        function calcCrow(lat1, lon1, lat2, lon2) {
            var R = 6371; // km
            var dLat = toRad(lat2 - lat1);
            var dLon = toRad(lon2 - lon1);
            var lat11 = toRad(lat1);
            var lat21 = toRad(lat2);
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) *
                    Math.sin(dLon / 2) *
                    Math.cos(lat11) *
                    Math.cos(lat21);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            var d = R * c;
            return d * 1000;
        }
        // Converts numeric degrees to radians
        function toRad(Value) {
            return (Value * Math.PI) / 180;
        }
        function getDirectionDataFromGoogle(payload) {
            var key = "AIzaSyAQHNDt38U6H8ONfV_hPEZzAT-FTQwNgYg";
            console.log("https://maps.googleapis.com/maps/api/directions/json?avoid=highways&destination=" +
                payload.lat1 +
                ",%20" +
                payload.lng1 +
                "&mode=walking&origin=" +
                payload.lat +
                ",%20" +
                payload.lng +
                "&key=" +
                key);
            return new Promise(function (resolve, reject) {
                request("https://maps.googleapis.com/maps/api/directions/json?avoid=highways&destination=" +
                    payload.lat1 +
                    ",%20" +
                    payload.lng1 +
                    "&mode=walking&origin=" +
                    payload.lat +
                    ",%20" +
                    payload.lng +
                    "&key=" +
                    key, { json: true }, (err, res, body) => {
                    if (err) {
                        reject(err);
                        return console.log(err);
                    }
                    resolve(body);
                });
            });
        }
    },
});
