import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import PrayerTimeSettings from "@/components/admin/PrayerTimeSettings"; // Import PrayerTimeSettings

const AdminPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Admin Panel Masjid TV</h1>
        <Button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 text-white">
          Kembali ke Display
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Prayer Time Settings */}
        <PrayerTimeSettings />

        {/* Placeholder for other Admin Sections */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Jadwal Imam & Muadzin</h2>
          <p className="text-gray-400">Kelola jadwal imam dan muadzin untuk sholat fardhu dan Jumat.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Notifikasi & Kajian</h2>
          <p className="text-gray-400">Tambahkan notifikasi PHBI, jadwal kajian rutin, dan event khusus.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Informasi Keuangan</h2>
          <p className="text-gray-400">Input data kas masuk, kas keluar, dan saldo masjid.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Konten Display</h2>
          <p className="text-gray-400">Atur slide info masjid, background, dan running text.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Pengaturan Umum</h2>
          <p className="text-gray-400">Konfigurasi mode Ramadan dan pengaturan lainnya.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;