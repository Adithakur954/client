import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../Header";
import SideBar from "../SideBar";

const AppLayout = ({ children }) => {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(true);

  const changeValue = () => {
    setVisible(!visible);
  };

  const isMapview = pathname.includes("mapview");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar with accent edge */}
      <div
        className={`fixed left-0 top-0 h-full z-40 transform transition-transform duration-500 ease-in-out
        ${visible ? "translate-x-0" : "-translate-x-full"} 
        bg-gray-900 shadow-xl flex`}
        style={{ width: "250px" }}
      >
        {/* Sidebar content */}
        <div className="flex-1">
          <SideBar />
        </div>

        {/* Accent edge + button */}
        <div className="w-2 bg-gray-800 relative">
          <button
            onClick={changeValue}
            className="absolute top-1/2 -right-4 transform -translate-y-1/2 p-2 rounded-full 
              bg-purple-600 text-white shadow-lg hover:bg-purple-500 transition-all duration-300"
          >
            {visible ? "⟨" : "⟩"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-500 ease-in-out 
        ${visible ? "ml-[250px]" : "ml-0"}`}
      >
        {/* ✅ ONLY render Header for non-map routes */}
        {!isMapview && <Header className="sticky top-0 z-30 bg-white shadow" />}
        
        {/* ✅ Map routes will render their own headers */}
        <main className={`flex-1 ${isMapview ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;