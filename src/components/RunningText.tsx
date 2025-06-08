import React from "react";

interface RunningTextProps {
  text: string;
}

const RunningText: React.FC<RunningTextProps> = ({ text }) => {
  return (
    <div className="w-full bg-gray-800 bg-opacity-70 p-4 rounded-lg shadow-xl mt-auto overflow-hidden">
      <p className="text-xl md:text-2xl text-gray-200 whitespace-nowrap animate-marquee">
        {text}
      </p>
    </div>
  );
};

export default RunningText;