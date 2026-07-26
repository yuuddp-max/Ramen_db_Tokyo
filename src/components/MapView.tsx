"use client";

import { useEffect, useRef } from "react";
import type { RamenShop } from "@/types/ramen";

declare global {
  interface Window { google?: { maps: any }; }
}

export type MapShop = Pick<RamenShop, "id" | "name" | "latitude" | "longitude" | "rating" | "user_ratings_total">;
type Props = { shops: MapShop[]; selected?: MapShop; currentLocation?: { latitude: number; longitude: number } | null; onShopSelect?: (shop: MapShop) => void; className?: string };

export function MapView({ shops, selected, currentLocation, onShopSelect, className = "" }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const lastCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastCurrentLocationKey = useRef<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !mapElement.current) return;
    let destroyMap: (() => void) | undefined;

    const initialise = () => {
      const googleMaps = window.google?.maps;
      if (!googleMaps || !mapElement.current) return;
      const currentLocationKey = currentLocation ? `${currentLocation.latitude.toFixed(5)},${currentLocation.longitude.toFixed(5)}` : null;
      const hasNewCurrentLocation = currentLocationKey !== null && currentLocationKey !== lastCurrentLocationKey.current;
      const focus = hasNewCurrentLocation ? { latitude: currentLocation!.latitude, longitude: currentLocation!.longitude } : lastCenter.current ?? selected ?? (currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : shops[0]);
      const map = new googleMaps.Map(mapElement.current, {
        center: "lat" in focus ? { lat: focus.lat, lng: focus.lng } : focus ? { lat: focus.latitude, lng: focus.longitude } : { lat: 35.6762, lng: 139.6503 },
        zoom: selected || hasNewCurrentLocation ? 16 : currentLocation ? 14 : 11,
      });
      lastCurrentLocationKey.current = currentLocationKey;
      const infoWindow = new googleMaps.InfoWindow();
      const shopsById = new Map(shops.map((shop) => [shop.id, shop]));

      // The Data layer handles thousands of points more efficiently than one
      // Marker instance per shop, while preserving click-through to details.
      map.data.addGeoJson({ type: "FeatureCollection", features: shops.map((shop) => ({ type: "Feature", properties: { shopId: shop.id }, geometry: { type: "Point", coordinates: [shop.longitude, shop.latitude] } })) });
      map.data.setStyle({ icon: { path: googleMaps.SymbolPath.CIRCLE, scale: 5, fillColor: "#e4ad42", fillOpacity: 0.9, strokeColor: "#111111", strokeWeight: 1.5 } });
      const shopClickListener = map.data.addListener("click", (event: any) => {
        const shop = shopsById.get(String(event.feature.getProperty("shopId")));
        if (!shop) return;
        onShopSelect?.(shop);
        const content = document.createElement("div");
        content.className = "min-w-[180px] p-1 text-slate-900";
        const name = document.createElement("p");
        name.className = "font-bold";
        name.textContent = shop.name;
        const rating = document.createElement("p");
        rating.className = "mt-1 text-sm";
        rating.textContent = `★ ${shop.rating?.toFixed(1) ?? "–"} （${shop.user_ratings_total?.toLocaleString() ?? 0}件）`;
        const link = document.createElement("a");
        link.href = `/shops/${shop.id}`;
        link.className = "mt-2 inline-block text-sm font-bold text-amber-700 underline";
        link.textContent = "店舗詳細を見る";
        content.append(name, rating, link);
        infoWindow.setContent(content);
        infoWindow.setPosition(event.latLng);
        infoWindow.open({ map });
      });
      const currentLocationMarker = currentLocation ? new googleMaps.Marker({
        position: { lat: currentLocation.latitude, lng: currentLocation.longitude }, map, title: "現在地", zIndex: 10,
        icon: { path: googleMaps.SymbolPath.CIRCLE, scale: 8, fillColor: "#e4ad42", fillOpacity: 1, strokeColor: "#111111", strokeWeight: 2 },
      }) : null;
      destroyMap = () => {
        const center = map.getCenter?.();
        if (center) lastCenter.current = { lat: center.lat(), lng: center.lng() };
        googleMaps.event.removeListener(shopClickListener);
        map.data.forEach((feature: any) => map.data.remove(feature));
        infoWindow.close();
        currentLocationMarker?.setMap(null);
      };
    };

    if (window.google?.maps) { initialise(); return () => destroyMap?.(); }
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      existing.addEventListener("load", initialise);
      return () => { existing.removeEventListener("load", initialise); destroyMap?.(); };
    }
    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly`;
    script.async = true;
    script.onload = initialise;
    document.head.appendChild(script);
    return () => { script.onload = null; destroyMap?.(); };
  }, [shops, selected, currentLocation, onShopSelect]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return <div className={`map-grid grid place-items-center text-center text-sm text-stone-400 ${className}`}><p>Google Maps APIキーを設定すると<br />地図を表示できます。</p></div>;
  }
  return <div ref={mapElement} className={className} aria-label="店舗地図" />;
}
