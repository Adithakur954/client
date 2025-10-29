// src/components/layout/AppLayout.jsx
import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import SideBar from "../SideBar";
import Header from "../Header";

const AppLayout = ({ children }) => {
  const [visible, setVisible] = useState(true);
  const location = useLocation();

  const changeValue = () => {
    setVisible(!visible);
  };

  // List of paths where the standard header should be hidden
  const pathsWithoutHeader = [
    "/mapview", 
    "/prediction-map", 
    "/map",
    "/unified-map"
  ];

  // Check if the current path starts with any of the paths in the list
  const shouldShowHeader = !pathsWithoutHeader.some((path) =>
    location.pathname.startsWith(path)
  );

  // Debug logging
  console.log("Current pathname:", location.pathname);
  console.log("Should show header:", shouldShowHeader);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar with accent edge */}
      <div
        className={`fixed left-0 top-0 h-full z-40 transform transition-transform duration-500 ease-in-out
        ${visible ? "translate-x-0" : "-translate-x-full"} 
        bg-gray-900 shadow-xl flex`}
        style={{ width: "250px" }}
      >
        {/* Sidebar content */}
        <div className="flex-1">
          <SideBar collapsed={!visible} />
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

      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-500 ease-in-out 
        ${visible ? "ml-[250px]" : "ml-0"}`}
      >
        {/* Conditionally render the standard header */}
        {shouldShowHeader && <Header />}

        {/* The main content for the page */}
        <main className={`flex-1 overflow-y-auto ${!shouldShowHeader ? 'h-full' : ''}`}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;