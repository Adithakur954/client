import { adminApi } from '@/api/apiEndpoints'
import React, { useEffect } from 'react'
import toast from 'react-hot-toast';


function UnifiedDetailLogs() {

    useEffect(()=>{
        const fetchDuration = async()=>{
            try {
                const resp = await adminApi.getNetworkDurations(payload);
                if(!resp)return;
            } catch (error) {
                console.error(error);
                toast.warn("Failed to fetch Time duration")
            }
            
        }

        fetchDuration();
    })
  return (
    <>
    
    </>
  )
}

export default UnifiedDetailLogs