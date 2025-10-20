import {useCallback} from 'react';
import {useSettings} from '../contexts/SettingsContext';

/**
 * Hook to format dates using the user's timezone setting
 */
export const useDateFormatter = () => {
    const {settings} = useSettings();

    const formatTime = useCallback((date: Date | string | number | null | undefined): string => {
        if (!date) return 'N/A';
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dateObj.toLocaleTimeString(undefined, {
            timeZone: settings.timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }, [settings.timezone]);

    const formatDateTime = useCallback((date: Date | string | number | null | undefined): string => {
        if (!date) return 'N/A';
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dateObj.toLocaleString(undefined, {
            timeZone: settings.timezone
        });
    }, [settings.timezone]);

    const formatDate = useCallback((date: Date | string | number | null | undefined): string => {
        if (!date) return 'N/A';
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dateObj.toLocaleDateString(undefined, {
            timeZone: settings.timezone
        });
    }, [settings.timezone]);

    const formatTimeCustom = useCallback((date: Date | string | number | null | undefined, options: Intl.DateTimeFormatOptions = {}): string => {
        if (!date) return 'N/A';
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dateObj.toLocaleTimeString(undefined, {
            ...options,
            timeZone: settings.timezone
        });
    }, [settings.timezone]);

    return {
        formatTime,
        formatDateTime,
        formatDate,
        formatTimeCustom,
        timezone: settings.timezone
    };
};
