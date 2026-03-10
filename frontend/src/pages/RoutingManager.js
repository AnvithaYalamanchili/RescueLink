import { useEffect, useState } from "react";
import { Polyline } from "react-leaflet";

// Fetch route from OSRM
async function fetchOSRMRoute(start, end) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // Swap coords for Leaflet: [lng, lat] -> [lat, lng]
      const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
      return {
        coords,
        distance: route.distance, // meters
        duration: route.duration // seconds
      };
    }
    return { coords: [], distance: 0, duration: 0 };
  } catch (err) {
    console.error("OSRM route fetch error:", err);
    return { coords: [], distance: 0, duration: 0 };
  }
}

export default function RoutingManager({ routes, onRouteInfo }) {
  const [volunteerRoutes, setVolunteerRoutes] = useState({});

  useEffect(() => {
    Object.entries(routes).forEach(async ([id, { start, end }]) => {
      const key = `${start[0]},${start[1]}-${end[0]},${end[1]}`;
      if (volunteerRoutes[id]?.key === key) return;

      const { coords, distance, duration } = await fetchOSRMRoute(start, end);

      setVolunteerRoutes(prev => ({
        ...prev,
        [id]: { coords, key, distance, duration }
      }));

      // Call parent callback to pass distance/duration
      if (onRouteInfo) {
        onRouteInfo(id, { distance, duration });
      }
    });
  }, [routes]);

  return (
    <>
      {Object.entries(volunteerRoutes).map(([id, route]) => (
        <Polyline
          key={id}
          positions={route.coords}
          color="blue"
          weight={4}
          opacity={0.6}
        />
      ))}
    </>
  );
}