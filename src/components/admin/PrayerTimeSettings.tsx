import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Dummy data for prayer times (should eventually come from a backend)
const PRAYER_TIMES = [
  { name: "Subuh", time: "04:30" },
  { name: "Dzuhur", time: "12:00" },
  { name: "Ashar", time: "15:30" },
  { name: "Maghrib", time: "18:00" },
  { name: "Isya", time: "19:15" },
];

const PrayerTimeSettings: React.FC = () => {
  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Jadwal Sholat & Iqomah</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur waktu sholat dan iqomah.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRAYER_TIMES.map((prayer) => (
            <div key={prayer.name} className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
              <span className="text-lg font-medium">{prayer.name}</span>
              <span className="text-lg text-gray-200">{prayer.time}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-4">
          (Fungsionalitas untuk mengedit waktu akan ditambahkan di kemudian hari.)
        </p>
      </CardContent>
    </Card>
  );
};

export default PrayerTimeSettings;