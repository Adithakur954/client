import React, { useState, useEffect, useCallback } from 'react';

import { adminApi } from '../api/apiEndpoints';
import { toast } from 'react-toastify';
import DataTable from '../components/common/DataTable';
import Spinner from '../components/common/Spinner';
import UserFormDialog from '../components/users/UserFormDialog';
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Card, CardContent,CardHeader } from "@/components/ui/card";
import { Label } from '@/components/ui/label';

const ManageUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [filters, setFilters] = useState({ UserName: '', MobileNo: '', EmailId: '' });
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage] = useState(10);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const apiFilters = {
                UserName: filters.UserName,
                Mobile: filters.MobileNo,
                Email: filters.EmailId,
            };
            const response = await adminApi.getUsers(apiFilters);
            const userData = response.Data?.map(item => item.ob_user) || [];
            setUsers(Array.isArray(userData) ? userData : []);
        } catch (error) {
            toast.error(error.message || 'Failed to fetch users.');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleOpenDialog = async (user = null) => {
        if (user) { 
            setIsDialogOpen(true);
            setIsFetchingDetails(true);
            try {
                const response = await adminApi.getUserById(user.id);
                setCurrentUser(response.Data);
            } catch (error) {
                toast.error("Failed to fetch latest user details.");
                setIsDialogOpen(false); 
            } finally {
                setIsFetchingDetails(false);
            }
        } else { 
            setCurrentUser(null);
            setIsDialogOpen(true);
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setCurrentUser(null);
    };

    const handleSaveUser = () => {
        // This is now just a callback to refresh data and close the dialog
        fetchUsers();
        handleCloseDialog();
    };

    const handleDeleteUser = async (userOrId) => {
        // accept either a user object or an id
        const userId = typeof userOrId === 'object'
            ? (userOrId.id ?? userOrId.UserId ?? userOrId.user_id ?? userOrId.userId)
            : userOrId;

        if (!userId) {
            console.error('Delete user missing id:', userOrId);
            toast.error('Cannot determine user id for delete.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await adminApi.deleteUser(userId);

            // treat API-specific success shapes: many internal APIs return Status:1 and Message
            const ok =
                response?.Status === 1 ||
                response?.Status === '1' ||
                response?.status === 200 ||
                response?.status === '200' ||
                response?.Success === true ||
                response?.success === true ||
                response?.IsSuccess === true ||
                (typeof response?.Message === 'string' && /success/i.test(response.Message));

            if (ok) {
                const successMsg = response?.Message || 'User deleted successfully!';
                toast.success(successMsg);
                fetchUsers();
            } else {
                const msg = response?.Message || response?.message || 'Failed to delete user.';
                console.error('Delete failed response:', response);
                toast.error(msg);
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error(error?.message || 'Failed to delete user.');
        }
    };
    
   const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({...prev, [name]: value}));
    };
    
    const handleReset = () => {
        setFilters({ UserName: '', MobileNo: '', EmailId: '' });
    };

    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = users.length > 0 ? Math.ceil(users.length / usersPerPage) : 1;

    const paginate = (pageNumber) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const columns = [
        { header: 'S. No.', render: (row, index) => <span>{indexOfFirstUser + index + 1}</span> },
        { header: 'User Name', accessor: 'name' },
        { header: 'User Type', accessor: 'user_type' },
        { header: 'Email ID', accessor: 'email' },
        { header: 'Mobile No.', accessor: 'mobileno' },
        
        {
            header: 'Action',
            render: (user) => (
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleOpenDialog(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    if (loading && users.length === 0) return <Spinner />;

    return (
        <div className="space-y-6 bg-gray-800 h-100% text-white">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Manage Users</h1>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="UserName">User Name</Label>
                            <Input id="UserName" name="UserName" value={filters.UserName} onChange={handleFilterChange} />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="MobileNo">Mobile No</Label>
                            <Input id="MobileNo" name="MobileNo" value={filters.MobileNo} onChange={handleFilterChange} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="EmailId">Email ID</Label>
                            <Input id="EmailId" name="EmailId" value={filters.EmailId} onChange={handleFilterChange} />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={fetchUsers} disabled={loading}>Search</Button>
                            <Button variant="outline" onClick={handleReset} disabled={loading}>Reset</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <div className="flex justify-end">
                         <Button onClick={() => handleOpenDialog()}>Add New User</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <div className="h-64 flex items-center justify-center"><Spinner/></div> : <DataTable columns={columns} data={currentUsers} />}
                </CardContent>
                <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-sm text-muted-foreground">
                        Showing {users.length > 0 ? indexOfFirstUser + 1 : 0} to {Math.min(indexOfLastUser, users.length)} of {users.length} entries.
                    </div>
                    <div className="flex items-center gap-2">
                         <Button
                            variant="outline"
                            size="sm"
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <span className="text-sm">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </Card>
            
            <UserFormDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveUser}
                user={currentUser}
            />
        </div>
    );
};

export default ManageUsersPage;