import React, { useState, useEffect } from 'react';
import { excelApi } from '../../api/apiEndpoints';
import { toast } from 'react-toastify';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";


const SessionSelector = ({ selectedSessions, setSelectedSessions }) => {
    const [sessions, setSessions] = useState([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                // You might need to adjust the date range based on your requirements
                const fromDate = new Date();
                fromDate.setFullYear(fromDate.getFullYear() - 1); // 1 year ago
                const toDate = new Date();

                const response = await excelApi.getSessions(fromDate, toDate);
                setSessions(response.Data || []);
            } catch (error) {
                toast.error(`Failed to fetch sessions: ${error.message}`);
            }
        };

        fetchSessions();
    }, []);

    const handleSelect = (sessionId) => {
        setSelectedSessions(prev =>
            prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {selectedSessions.length > 0
                        ? `${selectedSessions.length} session(s) selected`
                        : "Select sessions..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
                <Command>
                    <CommandInput placeholder="Search sessions..." />
                    <CommandEmpty>No sessions found.</CommandEmpty>
                    <CommandGroup>
                        {sessions.map((session) => (
                            <CommandItem
                                key={session.id}
                                onSelect={() => handleSelect(session.id)}
                            >
                                <Checkbox
                                    checked={selectedSessions.includes(session.id)}
                                    className="mr-2"
                                />
                                {session.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default SessionSelector;