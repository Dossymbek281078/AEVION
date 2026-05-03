"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildApi, type BuildVacancy } from "@/lib/build/api";

// Static city → [lat, lng] table. OSM has free reverse-geocoding but
// we don't want to hammer it on every render. Anything not in the
// table falls into a default Russia/CIS centre and gets jittered so
// markers don't stack. Add cities here as the platform expands.
const CITY_COORDS: Record<string, [number, number]> = {
  "Москва": [55.7558, 37.6173],
  "Moscow": [55.7558, 37.6173],
  "Санкт-Петербург": [59.9343, 30.3351],
  "Saint Petersburg": [59.9343, 30.3351],
  "Новосибирск": [55.0084, 82.9357],
  "Екатеринбург": [56.8389, 60.6057],
  "Казань": [55.8304, 49.0661],
  "Нижний Новгород": [56.2965, 43.9361],
  "Челябинск": [55.1644, 61.4368],
  "Самара": [53.1959, 50.1004],
  "Уфа": [54.7388, 55.9721],
  "Ростов-на-Дону": [47.2357, 39.7015],
  "Краснодар": [45.0355, 38.9753],
  "Пермь": [58.0105, 56.2502],
  "Воронеж": [51.6608, 39.2003],
  "Волгоград": [48.708, 44.5133],
  "Сочи": [43.6028, 39.7342],
  "Тюмень": [57.1522, 65.5272],
  "Алматы": [43.222, 76.8512],
  "Almaty": [43.222, 76.8512],
  "Астана": [51.1605, 71.4704],
  "Astana": [51.1605, 71.4704],
  "Нур-Султан": [51.1605, 71.4704],
  "Шымкент": [42.3417, 69.5901],
};

const DEFAULT_CENTRE: [number, number] = [55.7558, 37.6173]; // Moscow

const ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function jitter(seed: string): number {
  // Tiny deterministic jitter so multiple markers in one city don't
  // stack on a single pixel.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((h % 1000) / 1000 - 0.5) * 0.05;
}

type VacancyWithCity = BuildVacancy & { projectCity?: string | null };

export function VacancyMap() {
  const [vacancies, setVacancies] = useState<VacancyWithCity[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    buildApi
      .listVacancies({ status: "OPEN" })
      .then((r) => setVacancies(r.items as VacancyWithCity[]))
      .catch((e) => setErr((e as Error).message));
  }, []);

  const markers = useMemo(() => {
    if (!vacancies) return [];
    return vacancies.map((v) => {
      const city = v.projectCity?.trim() || "";
      const base = CITY_COORDS[city] || DEFAULT_CENTRE;
      const lat = base[0] + jitter(`${v.id}-lat`);
      const lng = base[1] + jitter(`${v.id}-lng`);
      return { id: v.id, title: v.title, salary: v.salary, city, lat, lng };
    });
  }, [vacancies]);

  if (err) {
    return <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>;
  }
  if (!vacancies) {
    return <div className="grid h-[70vh] place-items-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">Загружаю вакансии…</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <MapContainer
        center={DEFAULT_CENTRE}
        zoom={4}
        style={{ height: "70vh", width: "100%", background: "#0f172a" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={ICON}>
            <Popup>
              <div className="space-y-1">
                <div className="font-bold">{m.title}</div>
                {m.city && <div className="text-xs opacity-70">{m.city}</div>}
                {m.salary > 0 && (
                  <div className="text-xs">
                    {m.salary.toLocaleString("ru-RU")} ₽
                  </div>
                )}
                <Link
                  href={`/build/vacancy/${m.id}`}
                  className="mt-1 inline-block rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-950"
                >
                  Открыть →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="border-t border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-400">
        {markers.length} вакансий · координаты по городу (точное местоположение появится после интеграции геокодинга на бэке)
      </div>
    </div>
  );
}
