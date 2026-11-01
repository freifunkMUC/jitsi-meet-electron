export type MyRoomsSection = 'create' | 'import';

const EVENT = 'freifunkmeet-my-rooms-focus';

/**
 * Asks the "My rooms" drawer to show and focus a section.
 *
 * @param {MyRoomsSection} section - Section to focus.
 * @returns {void}
 */
export function requestMyRoomsFocus(section: MyRoomsSection) {
    window.dispatchEvent(new CustomEvent<MyRoomsSection>(EVENT, { detail: section }));
}

/**
 * Listens to focus requests for the "My rooms" drawer.
 *
 * @param {Function} listener - Listener.
 * @returns {Function} Removes the listener.
 */
export function onMyRoomsFocus(listener: (section: MyRoomsSection) => void): () => void {
    const handler = (e: Event) => listener((e as CustomEvent<MyRoomsSection>).detail);

    window.addEventListener(EVENT, handler);

    return () => window.removeEventListener(EVENT, handler);
}
