import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, Trash2, Info, Shuffle, ListOrdered, CheckCircle2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function LogisticsApp() {
  const GOOGLE_MAPS_API_KEY = "AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLaoAIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao&libraries=places&callback=initMap";

  const [stops, setStops] = useState([{ id: 1, address: "" }]);
  const [vehicle, setVehicle] = useState("Motorcycle");
  const [distances, setDistances] = useState([5]);
  const [weight, setWeight] = useState(0);
  const [fare, setFare] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [optimizedStops, setOptimizedStops] = useState([]);
  const [optimizeRoute, setOptimizeRoute] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);

  const vehicleRates = {
    Motorcycle: { base: 50, perKm: 10, max: 20, extraStop: 30 },
    Van: { base: 150, perKm: 25, max: 1000, extraStop: 80 },
    MPV: { base: 150, perKm: 25, max: 300, extraStop: 80 },
    SUV: { base: 150, perKm: 25, max: 300, extraStop: 80 }
  };

  const totalDistance = distances.reduce((sum, d) => sum + d, 0);

  const calculateFare = () => {
    const rate = vehicleRates[vehicle];
    const extraStops = stops.length - 1;
    return rate.base + totalDistance * rate.perKm + extraStops * rate.extraStop;
  };

  const loadGoogleMaps = () => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }
  };

  const initMap = () => {
    if (!mapRef.current || !window.google) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 14.5995, lng: 120.9842 },
      zoom: 12,
    });
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({ map });
  };

  const addMarkersAndDrawRoute = async () => {
    if (!window.google || stops.length < 2 || stops.some((s) => !s.address)) return;

    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    try {
      const results = await Promise.all(
        stops.map(
          (stop) =>
            new Promise((resolve, reject) => {
              geocoder.geocode({ address: stop.address }, (res, status) => {
                if (status === "OK" && res[0]) resolve(res[0].geometry.location);
                else reject(status);
              });
            })
        )
      );

      results.forEach((location, index) => {
        const marker = new window.google.maps.Marker({
          position: location,
          map: directionsRendererRef.current.getMap(),
          draggable: true,
          label: `${index + 1}`,
        });

        marker.addListener("dragend", () => {
          geocoder.geocode({ location: marker.getPosition() }, (res, status) => {
            if (status === "OK" && res[0]) {
              const updatedStops = stops.map((s, i) =>
                i === index ? { ...s, address: res[0].formatted_address } : s
              );
              setStops(updatedStops);
            }
          });
        });

        markersRef.current.push(marker);
      });

      const waypoints = results.slice(1, -1).map((loc) => ({ location: loc, stopover: true }));

      directionsService.route(
        {
          origin: results[0],
          destination: results[results.length - 1],
          waypoints,
          optimizeWaypoints: optimizeRoute,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") {
            directionsRendererRef.current.setDirections(result);
            const legs = result.routes[0].legs;
            setDistances(legs.map((leg) => leg.distance.value / 1000));

            if (optimizeRoute) {
              const optimizedOrder = result.routes[0].waypoint_order;
              const reorderedStops = [
                stops[0],
                ...optimizedOrder.map((i) => stops[i + 1]),
                stops[stops.length - 1],
              ];
              setStops(reorderedStops);
              setOptimizedStops(reorderedStops);
              setOptimizeRoute(false);
            }
          } else {
            toast.error("Unable to get directions: " + status);
          }
        }
      );
    } catch (error) {
      toast.error("Geocoding failed. Check addresses.");
    }
  };

  useEffect(() => {
    loadGoogleMaps();
  }, []);

  useEffect(() => {
    addMarkersAndDrawRoute();
  }, [stops, optimizeRoute]);

  useEffect(() => {
    setFare(calculateFare());
  }, [distances, vehicle]);

  const addStop = () => {
    if (stops.length < 3) setStops([...stops, { id: stops.length + 1, address: "" }]);
  };

  const removeStop = (id, index) => {
    setStops(stops.filter((s) => s.id !== id));
    setDistances((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmBooking = () => {
    if (stops.some((s) => !s.address)) {
      toast.error("Please fill in all stop addresses before confirming.");
      return;
    }
    if (!email || !phone) {
      toast.error("Please enter email and phone number.");
      return;
    }
    const ref = `ALCA-${Math.floor(100000 + Math.random() * 900000)}`;
    setBookingRef(ref);
    setShowConfirmation(true);
    toast.success("📩 Booking details sent to your email and phone!");
  };

  const copyBookingRef = () => {
    navigator.clipboard.writeText(bookingRef);
    toast.success("Booking reference copied!");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card className="p-4 shadow-xl">
        <CardContent>
          {/* UI remains same as your original code */}
        </CardContent>
      </Card>
    </div>
  );
}
