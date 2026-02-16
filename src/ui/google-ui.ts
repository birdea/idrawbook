import type { GoogleUser } from '../google';

export function updateGoogleUI(user: GoogleUser | null) {
    // Menu User UI
    const menuLogin = document.getElementById('menu-google-login');
    const menuInfo = document.getElementById('menu-user-info');
    const menuAvatar = document.getElementById('menu-user-avatar') as HTMLImageElement;
    const menuName = document.getElementById('menu-user-name');

    // Save Modal Drive Elements
    const driveLoginUI = document.getElementById('drive-login-ui');
    const driveSaveUI = document.getElementById('drive-save-ui');

    if (user) {
        // Menu
        menuLogin?.classList.add('hidden');
        menuInfo?.classList.remove('hidden');
        if (menuAvatar) menuAvatar.src = user.picture;
        if (menuName) menuName.textContent = user.name;

        // Save Modal
        driveLoginUI?.classList.add('hidden');
        driveSaveUI?.classList.remove('hidden');

    } else {
        // Menu
        menuLogin?.classList.remove('hidden');
        menuInfo?.classList.add('hidden');

        // Save Modal
        driveLoginUI?.classList.remove('hidden');
        driveSaveUI?.classList.add('hidden');
    }
}
