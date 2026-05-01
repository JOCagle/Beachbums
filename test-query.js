const https = require('https');
https.get('https://api.mapbox.com/v4/jcagle0513.cmlkefqyp0lve1ok643wotmic-0910x/tilequery/-79.745,32.80.json?layers=iop_beach_access_points&limit=200&radius=12000&geometry=point&access_token=pk.eyJ1IjoiamNhZ2xlMDUxMyIsImEiOiJjbWtlZjZtNTEwNmpjM2ZwdzNncmd4bmtxIn0.77ShM5FPhsnCEu4k3YJoxw', res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        const data = JSON.parse(body);
        const hits = data.features.filter(f => f.properties.name && (f.properties.name.toLowerCase().includes('palms') || f.properties.name.toLowerCase().includes('seaside')));
        console.log(JSON.stringify(hits.map(h => ({ name: h.properties.name, coords: h.geometry.coordinates })), null, 2));
    });
});


/* Boardwalk Inn protection loaded via assets/boardwalk-inn-access-logic-fix.js */
