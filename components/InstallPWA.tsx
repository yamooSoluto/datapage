// components/InstallPWA.tsx
import { useState, useEffect } from 'react';

export default function InstallPWA() {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setSupportsPWA(true);
            setPromptInstall(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // iOS 체크
        if ('standalone' in window.navigator && (window.navigator as any).standalone === false) {
            // iOS Safari에서 실행 중
            setSupportsPWA(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const onClick = (evt) => {
        evt.preventDefault();
        if (!promptInstall) {
            return;
        }
        promptInstall.prompt();
    };

    if (!supportsPWA) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 bg-yellow-400 p-4 rounded-lg shadow-lg z-50">
            <p className="text-sm font-medium mb-2">
                홈 화면에 추가하여 앱처럼 사용하세요!
            </p>
            <button
                onClick={onClick}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm"
            >
                앱 설치
            </button>
        </div>
    );
}