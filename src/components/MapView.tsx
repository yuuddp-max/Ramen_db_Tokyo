"use client";

import { useEffect, useRef } from "react";
import type { RamenShop } from "@/types/ramen";

declare global {
  interface Window { google?: { maps: any }; }
}

type Props = { shops: RamenShop[]; selected?: RamenShop; className?: string };

export function MapView({ shops, selected, className = "" }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !mapElement.current) return;
    let destroyMap: (() => void) | undefined;

    const initialise = () => {
      const googleMaps = window.google?.maps;
      if (!googleMaps || !mapElement.current) return;
      const focus = selected ?? shops[0];
      const map = new googleMaps.Map(mapElement.current, {
        center: focus ? { lat: focus.latitude, lng: focus.longitude } : { lat: 35.6762, lng: 139.6503 },
        zoom: selected ? 15 : 11,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#d9c9b7" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#37302a" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#121212" }] },
        ],
      });
      const infoWindow = new googleMaps.InfoWindow();
      const markers = shops.map((shop) => {
        const marker = new googleMaps.Marker({
          position: { lat: shop.latitude, lng: shop.longitude }, map, title: shop.name,
        });
        marker.addListener("click", () => {
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
      destroyMap = () => { infoWindow.close(); markers.forEach((marker: any) => marker.setMap(null)); };
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
  }, [shops, selected]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return <div className={`map-grid grid place-items-center text-center text-sm text-stone-400 ${className}`}><p>Google Maps APIキーを設定すると<br />地図を表示できます。</p></div>;
  }
  return <div ref={mapElement} className={className} aria-label="店舗地図" />;
}
