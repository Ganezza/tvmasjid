import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

// Import components to display in the screensaver
import FinancialDisplay from "@/components/FinancialDisplay";
import ImamMuezzinDisplay from "@/components/ImamMuezzinDisplay";
import IslamicHolidayCountdown from "@/components/IslamicHolidayCountdown";
import InfoSlides from "@/components/InfoSlides";

const Screensaver: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[100] flex items-center justify-center text-white">
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        autoplay={{
          delay: 10000, // Each slide visible for 10 seconds
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={false}
        modules={[Autoplay, Pagination, Navigation]}
        className="w-full h-full"
      >
        <SwiperSlide className="flex items-center justify-center p-8">
          <FinancialDisplay />
        </SwiperSlide>
        <SwiperSlide className="flex items-center justify-center p-8">
          <ImamMuezzinDisplay />
        </SwiperSlide>
        <SwiperSlide className="flex items-center justify-center p-8">
          <IslamicHolidayCountdown />
        </SwiperSlide>
        <SwiperSlide className="flex items-center justify-center p-8">
          {/* InfoSlides component already handles its own internal image carousel */}
          <InfoSlides />
        </SwiperSlide>
      </Swiper>
    </div>
  );
};

export default Screensaver;