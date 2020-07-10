cask 'freifunk-meet' do
  version '2.0.24'
  sha256 '4b7ac2d726ee4fde949c85f55031b90b54a22271af1410d9f9434a0142088498'

  url 'https://github.com/freifunkMUC/jitsi-meet-electron/releases/download/v#{version}/ffmuc-meet.dmg'
  appcast 'https://github.com/FreifunkMUC/jitsi-meet-electron/releases.atom'
  name 'FreifunkMeet'
  homepage 'https://github.com/FreifunkMUC/jitsi-meet-electron'

  app 'FreifunkMeet.app'

  zap trash: [
               '~/Library/Application Support/FreifunkMeet',
               '~/Library/Logs/FreifunkMeet',
             ]
end
