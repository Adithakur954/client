// src/components/SideBar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Upload, History, Map, Settings, FolderPlus, Users, ReceiptPoundSterling, BarChartHorizontal } from 'lucide-react'; // Added BarChartHorizontal for Prediction
import VinfocomLogo from '../assets/vinfocom_logo.png'; // Assuming logo path is correct

const SideBar = ({ collapsed }) => { // Removed isMapview prop, layout handles header visibility
    const navLinks = [
        { icon: LayoutDashboard, text: 'Dashboard', path: '/dashboard' },
        { icon: Upload, text: 'Upload Data', path: '/upload-data' },
        { icon: History, text: 'Manage Drive Sessions', path: '/drive-test-sessions' },
        // Main Map View (Logs, Filters, Drawing)
        { icon: Map, text: 'Map View', path: '/mapview' },
        // Prediction Map View
        // { icon: BarChartHorizontal, text: 'Prediction Viewer', path: '/prediction-map'}, // Added Prediction Link
        { icon: FolderPlus, text: 'Projects', path: '/create-project' },
        { icon: Users, text: 'Manage User', path: '/manage-users' },
        { icon: ReceiptPoundSterling, text: 'Get Report', path: '/getreport' }, // Corrected case
        { icon: Settings, text: 'Setting', path: '/settings' }, // Corrected case
        // Example link for specific session map (usually navigated to, not direct link)
        // { icon: MapPin, text: 'Specific Session Map', path: '/map?session=123' },
    ];

    return (
        <div
            className={`h-screen bg-gray-800 text-white flex flex-col shadow-lg transition-width duration-300 ease-in-out
                ${collapsed ? 'w-16' : 'w-60'}`} // Use transition-width
        >
            {/* Logo */}
            <div className="p-4 flex items-center justify-center border-b border-gray-700 h-16 flex-shrink-0"> {/* Ensure consistent height */}
                <img src={VinfocomLogo} alt="Logo" className="h-8 sm:h-10 object-contain" /> {/* Adjusted size */}
                {!collapsed && <span className="ml-2 font-bold text-lg whitespace-nowrap">NetPulse</span>} {/* Added text size and nowrap */}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-2"> {/* Added overflow-y-auto */}
                <ul>
                    {navLinks.map((link, index) => (
                        <li key={index} className="mb-1 sm:mb-2"> {/* Adjusted margin */}
                            <NavLink
                                to={link.path}
                                className={({ isActive }) =>
                                    `flex items-center p-2 sm:p-3 rounded-lg transition-colors duration-200 ${
                                        isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    } ${collapsed ? 'justify-center' : ''}` // Center icon when collapsed
                                }
                                title={collapsed ? link.text : undefined} // Tooltip when collapsed
                            >
                                <link.icon className={`h-5 w-5 flex-shrink-0 ${!collapsed ? 'mr-3' : ''}`} /> {/* Ensure icon shrinks */}
                                {!collapsed && <span className="font-medium whitespace-nowrap">{link.text}</span>} {/* Added nowrap */}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            {/* Optional: Footer or user section */}
            {/* <div className="p-2 border-t border-gray-700"> ... </div> */}
        </div>
    );
};

export default SideBar;