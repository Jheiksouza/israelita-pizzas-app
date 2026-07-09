const usb = require('usb')

try {
  const devices = usb.getDeviceList()
  console.log('Dispositivos USB encontrados:', devices.length)
  devices.forEach((d, i) => {
    const vid = '0x' + d.deviceDescriptor.idVendor.toString(16).padStart(4, '0')
    const pid = '0x' + d.deviceDescriptor.idProduct.toString(16).padStart(4, '0')
    console.log(`  [${i}] VID:${vid} PID:${pid}`)
  })
  console.log('\nPara usar, defina as variaveis:')
  console.log('  $env:USB_VID="0xXXXX"')
  console.log('  $env:USB_PID="0xXXXX"')
} catch (e) {
  console.error('Erro:', e.message)
}
