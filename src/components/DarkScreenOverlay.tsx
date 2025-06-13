import React from "react";

const DarkScreenOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black z-[90] flex items-center justify-center">
      {/* Konten opsional di sini, misalnya logo masjid atau pesan singkat */}
    </div>
  );
};

export default DarkScreenOverlay;