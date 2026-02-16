import type { GoogleUser } from '../google';

export function updateGoogleUI(user: GoogleUser | null) {
    // Menu User UI
    const menuLogin = document.getElementById('menu-google-login');
    const menuInfo = document.getElementById('menu-user-info');
    const menuAvatar = document.getElementById('menu-user-avatar') as HTMLImageElement;
    const menuName = document.getElementById('menu-user-name');

    // Save Modal Drive Elements
    const driveStatus = document.getElementById('drive-status');
    const driveFolderUI = document.getElementById('drive-folder-ui');
    const btnSaveDrive = document.getElementById('btn-save-drive') as HTMLButtonElement;

    if (user) {
        // Menu
        menuLogin?.classList.add('hidden');
        menuInfo?.classList.remove('hidden');
        if (menuAvatar) menuAvatar.src = user.picture;
        if (menuName) menuName.textContent = user.name;

        // Save Modal
        driveStatus?.classList.remove('hidden');
        driveFolderUI?.classList.remove('hidden');
        btnSaveDrive?.removeAttribute('disabled');

    } else {
        // Menu
        menuLogin?.classList.remove('hidden');
        menuInfo?.classList.add('hidden');

        // Save Modal
        driveStatus?.classList.add('hidden');
        driveFolderUI?.classList.add('hidden');
        btnSaveDrive?.setAttribute('disabled', 'true');
    }
}
