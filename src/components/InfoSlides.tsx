import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

interface Slide {
  id: number;
  type: "text" | "image";
  content: string; // Text or image URL
  title?: string;
}

const dummySlides: Slide[] = [
  {
    id: 1,
    type: "text",
    title: "Pengumuman Penting",
    content: "Diumumkan kepada seluruh jamaah, kajian rutin ba'da Maghrib setiap hari Selasa ditiadakan untuk sementara waktu.",
  },
  {
    id: 2,
    type: "text",
    title: "Jadwal Kajian",
    content: "Kajian Fiqih bersama Ustadz Ahmad: Setiap Sabtu, Pukul 09.00 WIB. Tema: Rukun Islam.",
  },
  {
    id: 3,
    type: "image",
    title: "Donasi Pembangunan Masjid",
    content: "https://via.placeholder.com/800x400/22c55e/ffffff?text=Donasi+Masjid", // Placeholder image
  },
  {
    id: 4,
    type: "text",
    title: "Kebersihan Sebagian dari Iman",
    content: "Mari bersama menjaga kebersihan masjid. Buang sampah pada tempatnya dan jaga fasilitas masjid dengan baik.",
  },
];

const InfoSlides: React.FC = () => {
  return (
    <div className="w-11/12 max-w-4xl h-64 md:h-80 bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden mb-8">
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={false} // Disable navigation arrows for a cleaner look
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper w-full h-full"
      >
        {dummySlides.map((slide) => (
          <SwiperSlide key={slide.id} className="flex items-center justify-center p-4">
            {slide.type === "text" ? (
              <div className="text-center text-gray-200">
                {slide.title && <h3 className="text-3xl md:text-4xl font-bold mb-4 text-blue-300">{slide.title}</h3>}
                <p className="text-xl md:text-2xl leading-relaxed">{slide.content}</p>
              </div>
            ) : (
              <img
                src={slide.content}
                alt={slide.title || "Info Slide"}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default InfoSlides;