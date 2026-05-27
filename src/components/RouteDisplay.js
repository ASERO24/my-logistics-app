import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet/dist/leaflet.css";

export default function RouteDisplay({ map, waypoints }) {
  const routingRef = useRef(null);

  useEffect(() => {
    if (!map || !waypoints || waypoints.length < 2) return;

    if (routingRef.current && typeof routingRef.current.setWaypoints === "function") {
      const currentWaypoints = routingRef.current.getWaypoints();
      const currentCount = currentWaypoints.length;
      const newCount = waypoints.length;

      if (currentCount === newCount) {
        try {
          routingRef.current.setWaypoints(waypoints);
          return;
        } catch (err) {
          console.warn("Failed to update waypoints, forcing rebuild:", err);
        }
      } else {
        try {
          map.removeControl(routingRef.current);
        } catch (cleanupErr) {
          console.warn("Error removing old control:", cleanupErr);
        } finally {
          routingRef.current = null;
        }
      }
    }

    const control = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: true,
      showAlternatives: false,
      lineOptions: {
        styles: [{ color: "blue", weight: 4 }]
      },
      createMarker: (i, wp) => {
        const marker = L.marker(wp.latLng, { draggable: true });
        marker.on("dragend", () => {
          const newWaypoints = routingRef.current.getWaypoints().map(w => w.latLng);
          newWaypoints[i] = marker.getLatLng();
          routingRef.current.setWaypoints(newWaypoints);
        });
        return marker;
      }
    }).addTo(map);

    routingRef.current = control;

    return () => {
      if (map && routingRef.current) {
        try {
          map.removeControl(routingRef.current);
        } catch (err) {
          console.warn("Error cleaning up routing control:", err);
        } finally {
          routingRef.current = null;
        }
      }
    };
  }, [map, waypoints]);

  return null;
}
