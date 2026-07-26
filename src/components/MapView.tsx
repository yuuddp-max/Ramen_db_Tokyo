"use client";

import { useEffect, useRef } from "react";
import type { RamenShop } from "@/types/ramen";

declare global {
  interface Window { google?: { maps: any }; }
}

type MapBounds = { north: number; south: number; east: number; west: number };
type Props = { shops: RamenShop[]; selected?: RamenShop; currentLocation?: { latitude: number; longitude: number } | null; onShopSelect?: (shop: RamenShop) => void; onBoundsChange?: (bounds: MapBounds) => void; className?: string };

export function MapView({ shops, selected, currentLocation, onShopSelect, onBoundsChange, className = "" }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !mapElement.current) return;
    let destroyMap: (() => void) | undefined;

    const initialise = () => {
      const googleMaps = window.google?.maps;
      if (!googleMaps || !mapElement.current) return;
      const focus = selected ?? (currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : shops[0]);
      const map = new googleMaps.Map(mapElement.current, {
        center: focus ? { lat: focus.latitude, lng: focus.longitude } : { lat: 35.6762, lng: 139.6503 },
        zoom: selected ? 15 : currentLocation ? 13 : 11,
      });
      const infoWindow = new googleMaps.InfoWindow();
      const boundsListener = map.addListener("idle", () => {
        const bounds = map.getBounds?.();
        if (!bounds) return;
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        onBoundsChange?.({ north: northEast.lat(), east: northEast.lng(), south: southWest.lat(), west: southWest.lng() });
      });
      const markers = shops.map((shop) => {
        const marker = new googleMaps.Marker({
          position: { lat: shop.latitude, lng: shop.longitude }, map, title: shop.name,
        });
        marker.addListener("click", () => {
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
          infoWindow.open({ map, anchor: marker });
        });
        return marker;
      });
      if (currentLocation) {
        markers.push(new googleMaps.Marker({
          position: { lat: currentLocation.latitude, lng: currentLocation.longitude },
          map,
          title: "現在地",
          zIndex: 10,
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#e4ad42",
            fillOpacity: 1,
            strokeColor: "#111111",
            strokeWeight: 2,
          },
        }));
      }
      destroyMap = () => { googleMaps.event.removeListener(boundsListener); infoWindow.close(); markers.forEach((marker: any) => marker.setMap(null)); };
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
  }, [shops, selected, currentLocation, onShopSelect, onBoundsChange]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return <div className={`map-grid grid place-items-center text-center text-sm text-stone-400 ${className}`}><p>Google Maps APIキーを設定すると<br />地図を表示できます。</p></div>;
  }
  return <div ref={mapElement} className={className} aria-label="店舗地図" />;
}
