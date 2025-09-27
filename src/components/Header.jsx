import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { LogOut } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-18 bg-gray-800 text-white  shadow-sm flex items-center justify-between px-8 flex-shrink-0">
      <div>
        {/* Placeholder for breadcrumbs or page titles */}
      </div>
      <div className="flex items-center space-x-4">
        <p className="text-gray-300 text-sm">
          Welcome, <span className="font-semibold text-white">{user?.name || 'Amit Sethi'}</span>
        </p>
        <Button onClick={logout} variant="default" size="sm" className="text-white">
          <LogOut className="h-4 w-4 mr-2 text-white" />
          Logout
        </Button>
      </div>
    </header>
  );
}