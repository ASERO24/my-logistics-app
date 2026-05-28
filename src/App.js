import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import "./App.css";
const logoUrl = "/alca-logo.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const vehicleRates = {
  Motorcycle: { base: 50, perKm: 10, extraStop: 30 },
  Sedan: { base: 120, perKm: 20, extraStop: 80 },
  MPV: { base: 140, perKm: 22, extraStop: 80 },
  SUV: { base: 140, perKm: 23, extraStop: 80 },
  Van: { base: 150, perKm: 30, extraStop: 80 },
};

const gcashName = "ALCA Logistics";
const gcashNumber = "09XX XXX XXXX";

function calculateFare(distanceKm, vehicle, stops = 0) {
  const rate = vehicleRates[vehicle] || vehicleRates.Motorcycle;
  const km = Number(distanceKm || 0);
  return Math.ceil(rate.base + km * rate.perKm + Number(stops || 0) * rate.extraStop);
}

function ChangeMapView({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, 14);
  }, [coords, map]);
  return null;
}

function MapClickHandler({ pickupCoords, dropoffCoords, setPickupCoords, setDropoffCoords }) {
  useMapEvents({
    click(e) {
      if (!pickupCoords) setPickupCoords([e.latlng.lat, e.latlng.lng]);
      else if (!dropoffCoords) setDropoffCoords([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function RouteDisplay({ pickupCoords, dropoffCoords, extraStopsCoords, vehicle, setDistance, setFare }) {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return;

    if (routingRef.current) {
      try { map.removeControl(routingRef.current); } catch (err) { console.warn(err); }
      routingRef.current = null;
    }

    const validStops = (extraStopsCoords || []).filter((s) => s.lat && s.lng);
    const waypoints = [
      pickupCoords,
      ...validStops.map((s) => [s.lat, s.lng]),
      dropoffCoords,
    ].map(([lat, lng]) => L.latLng(lat, lng));

    routingRef.current = L.Routing.control({
      waypoints,
      lineOptions: { styles: [{ color: "#d4af37", weight: 5 }] },
      createMarker: () => null,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
    })
      .on("routesfound", (e) => {
        const route = e.routes?.[0];
        if (!route?.summary) return;
        const km = Number((route.summary.totalDistance / 1000).toFixed(2));
        setDistance(km);
        setFare(calculateFare(km, vehicle, validStops.length));
      })
      .addTo(map);

    return () => {
      if (routingRef.current) {
        try { map.removeControl(routingRef.current); } catch (err) { console.warn(err); }
        routingRef.current = null;
      }
    };
  }, [map, pickupCoords, dropoffCoords, JSON.stringify(extraStopsCoords), vehicle, setDistance, setFare]);

  return null;
}

export default function App() {
  const [step, setStep] = useState(1);
  const [center, setCenter] = useState([14.5995, 120.9842]);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [extraStops, setExtraStops] = useState(0);
  const [extraStopsCoords, setExtraStopsCoords] = useState([]);
  const [vehicle, setVehicle] = useState("Motorcycle");
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverNumber, setReceiverNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const [gcashRef, setGcashRef] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [showDropMenu, setShowDropMenu] = useState(false);

  async function geocode(address, setter) {
    if (!address.trim()) return alert("Ilagay muna ang address.");
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (!data.length) return alert("Address not found. Try another address.");
    const coords = [Number(data[0].lat), Number(data[0].lon)];
    setter(coords);
    setCenter(coords);
  }

  async function reverseGeocode(lat, lon, callback) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data?.display_name) callback(data.display_name);
    } catch (err) {
      console.warn("Reverse geocode failed", err);
    }
  }

  function removePickup() {
    setPickupCoords(null);
    setPickup("");
  }

  function removeDropoff() {
    setDropoffCoords(null);
    setDropoff("");
  }

  function removeExtraStop(idx) {
    const copy = [...extraStopsCoords];
    copy.splice(idx, 1);
    setExtraStopsCoords(copy);
    setExtraStops(extraStops - 1);
  }

  function setNumDrops(num) {
    setExtraStops(num);
    const copy = [...extraStopsCoords];
    while (copy.length < num) copy.push({ lat: 0, lng: 0, address: "" });
    setExtraStopsCoords(copy.slice(0, num));
    setShowDropMenu(false);
  }

  function goToDetails() {
    if (!pickupCoords || !dropoffCoords) return alert("Set Pickup at Drop-off muna.");
    setFare(calculateFare(distance, vehicle, extraStopsCoords.filter((s) => s.lat && s.lng).length));
    setStep(2);
  }

  function goToConfirm() {
    if (!senderName || !senderNumber || !senderEmail || !receiverName || !receiverNumber) {
      return alert("Kumpletuhin muna ang sender/receiver details.");
    }
    setStep(3);
  }

  async function submitBooking() {
    if (paymentMethod === "GCash" && !gcashRef.trim()) return alert("Ilagay ang GCash reference number.");
    const trackingCode = `ALCA-${Date.now().toString().slice(-8)}`;
    const bookingData = {
      trackingCode,
      status: "Pending rider assignment",
      pickup: pickup || "Pinned on map",
      dropoff: dropoff || "Pinned on map",
      pickupCoords,
      dropoffCoords,
      extraStops: extraStopsCoords,
      vehicle,
      distanceKm: distance,
      totalFare: fare,
      paymentMethod,
      gcashRef: paymentMethod === "GCash" ? gcashRef : "",
      senderName,
      senderNumber,
      senderEmail,
      receiverName,
      receiverNumber,
      notes,
      rider: { name: "Waiting for admin", phone: "", location: null },
      confirmation: {
        email: senderEmail ? "Ready for email notification" : "No email",
        sms: senderNumber ? "Ready for SMS provider integration" : "No mobile number",
      },
      createdAt: serverTimestamp(),
      createdAtText: new Date().toLocaleString(),
    };

    try {
      await addDoc(collection(db, "bookings"), bookingData);
      setBookingId(trackingCode);
      alert(`✅ Booking saved! Tracking ID: ${trackingCode}`);
    } catch (error) {
      console.error(error);
      alert("Hindi na-save sa Firebase. Check Firebase rules/config.");
    }
  }

  const Progress = () => (
    <div className="progress">
      {["Step 1 Pickup", "Step 2 Receiver Details", "Step 3 Confirm Booking"].map((label, index) => (
        <div key={label} className={`progress-item ${step >= index + 1 ? "active" : ""}`}>{label}</div>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoUrl} alt="ALCA Logo" className="logo" />
          <div>
            <h1>ALCA Logistics</h1>
            <p>Booking Schedule</p>
          </div>
        </div>

        <div className="tabs">
          <button className="tab active">Booking</button>
        </div>

        <>
          <Progress />

          {step === 1 && (
            <div className="panel">
              <label>Pickup Address</label>
              <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Enter pickup address" />
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="primary" onClick={() => geocode(pickup, setPickupCoords)}>Set Pickup 📍</button>
                {pickupCoords && <button className="danger" onClick={removePickup}>Remove ✕</button>}
              </div>
              {pickupCoords && <p style={{ fontSize: "12px", color: "#666" }}>📍 Pinned: {pickup || "On Map"}</p>}

              <label>Drop-off Address</label>
              <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Enter drop-off address" />
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="success" onClick={() => geocode(dropoff, setDropoffCoords)}>Set Drop-off 🏁</button>
                {dropoffCoords && <button className="danger" onClick={removeDropoff}>Remove ✕</button>}
              </div>
              {dropoffCoords && <p style={{ fontSize: "12px", color: "#666" }}>🏁 Pinned: {dropoff || "On Map"}</p>}

              <label>Vehicle Needed</label>
              <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                {Object.keys(vehicleRates).map((v) => <option key={v}>{v}</option>)}
              </select>

              <label>Additional Drops 🚚</label>
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <button 
                  className="secondary" 
                  onClick={() => setShowDropMenu(!showDropMenu)}
                  style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  {extraStops === 0 ? "Select Drops (0)" : `Selected: Drop ${extraStops}`}
                  <span style={{ fontSize: "16px" }}>▼</span>
                </button>
                {showDropMenu && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    zIndex: 10,
                    marginTop: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                  }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        onClick={() => setNumDrops(num)}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          textAlign: "left",
                          border: "none",
                          backgroundColor: extraStops === num ? "#e8f0fe" : "#fff",
                          cursor: "pointer",
                          fontSize: "14px",
                          borderBottom: "1px solid #eee",
                          color: extraStops === num ? "#1976d2" : "#333",
                          fontWeight: extraStops === num ? "600" : "400",
                        }}
                      >
                        {num === 0 ? "None" : `Drop ${num}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {Array.from({ length: extraStops }, (_, idx) => (
                <div className="mini-card" key={idx}>
                  <input placeholder={`Drop ${idx + 1} Address`} value={extraStopsCoords[idx]?.address || ""} onChange={(e) => {
                    const copy = [...extraStopsCoords];
                    copy[idx] = { ...copy[idx], address: e.target.value };
                    setExtraStopsCoords(copy);
                  }} />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="secondary" onClick={() => geocode(extraStopsCoords[idx]?.address || "", (coords) => {
                      const copy = [...extraStopsCoords];
                      copy[idx] = { lat: coords[0], lng: coords[1], address: extraStopsCoords[idx]?.address || "" };
                      setExtraStopsCoords(copy);
                    })}>Set Drop</button>
                    {extraStopsCoords[idx]?.lat && extraStopsCoords[idx]?.lng && (
                      <button className="danger" onClick={() => removeExtraStop(idx)}>Remove ✕</button>
                    )}
                  </div>
                  {extraStopsCoords[idx]?.lat && extraStopsCoords[idx]?.lng && (
                    <p style={{ fontSize: "12px", color: "#666", margin: "4px 0 0 0" }}>📍 Drop {idx + 1}: {extraStopsCoords[idx]?.address || "On Map"}</p>
                  )}
                </div>
              ))}

              <div className="fare-box">
                <span>Distance</span><b>{distance || 0} km</b>
                <span>Total Fare</span><b>₱{fare || calculateFare(distance, vehicle, extraStopsCoords.filter((s) => s.lat && s.lng).length)}</b>
              </div>
              <button className="gold" onClick={goToDetails}>Next: Receiver Details →</button>
            </div>
          )}

          {step === 2 && (
            <div className="panel">
              <label>Sender Name</label><input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              <label>Sender Number</label><input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} />
              <label>Sender Email</label><input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
              <label>Receiver Name</label><input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
              <label>Receiver Number</label><input value={receiverNumber} onChange={(e) => setReceiverNumber(e.target.value)} />
              <label>Additional Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="gold" onClick={goToConfirm}>Next: Confirm Booking →</button>
            </div>
          )}

          {step === 3 && (
            <div className="panel">
              <h2>Confirm Booking</h2>
              <div className="summary">
                <p><b>Pickup:</b> {pickup || "Pinned on map"}</p>
                <p><b>Drop-off:</b> {dropoff || "Pinned on map"}</p>
                <p><b>Additional Drops:</b> {extraStops > 0 ? `${extraStops} stops` : "None"}</p>
                <p><b>Vehicle:</b> {vehicle}</p>
                <p><b>Distance:</b> {distance} km</p>
                <p><b>Total Fare:</b> ₱{fare}</p>
              </div>

              <label>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option>GCash</option>
                <option>Cash on Pickup</option>
              </select>

              {paymentMethod === "GCash" && (
                <div className="gcash-box">
                  <h3>GCash Payment</h3>
                  <p>Send payment to:</p>
                  <b>{gcashName}</b>
                  <b>{gcashNumber}</b>
                  <input placeholder="GCash Reference Number" value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} />
                </div>
              )}

              <button className="secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="gold" onClick={submitBooking}>✅ Submit Booking</button>

              {bookingId && (
                <div className="tracking-card">
                  <h3>Rider Tracking</h3>
                  <p><b>Tracking ID:</b> {bookingId}</p>
                  <p><b>Status:</b> Pending rider assignment</p>
                  <p>Email/SMS confirmation data is saved. Actual sending needs Email/SMS provider API.</p>
                </div>
              )}
            </div>
          )}
        </>
      </aside>

      <main className="map-area">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <ChangeMapView coords={center} />
          <MapClickHandler pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} setPickupCoords={setPickupCoords} setDropoffCoords={setDropoffCoords} />
          <TileLayer attribution="&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {pickupCoords && dropoffCoords && <RouteDisplay pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} extraStopsCoords={extraStopsCoords} vehicle={vehicle} setDistance={setDistance} setFare={setFare} />}
          {pickupCoords && <Marker position={pickupCoords} draggable eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); setPickupCoords([lat, lng]); reverseGeocode(lat, lng, (addr) => setPickup(addr)); } }} />}
          {dropoffCoords && <Marker position={dropoffCoords} draggable eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); setDropoffCoords([lat, lng]); reverseGeocode(lat, lng, (addr) => setDropoff(addr)); } }} />}
          {extraStopsCoords.map((s, i) => s.lat && s.lng ? <Marker key={i} position={[s.lat, s.lng]} draggable><Popup>Drop {i + 1}</Popup></Marker> : null)}
        </MapContainer>
      </main>
    </div>
  );
}
