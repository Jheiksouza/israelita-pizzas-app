const usb = require('usb')

try {
  const devices = usb.getDeviceList()
  console.log('Dispositivos USB encontrados:')
  devices.forEach((d, i) => {
    const desc = {
      index: i,
      vendorId: '0x' + d.deviceDescriptor.idVendor.toString(16).padStart(4, '0'),
      productId: '0x' + d.deviceDescriptor.idProduct.toString(16).padStart(4, '0'),
    }
    try {
      const manufacturer = d.deviceDescriptor.iManufacturer
      const product = d.deviceDescriptor.iProduct
      console.log(`  [${desc.index}] VID:${desc.vendorId} PID:${desc.productId}`)
    } catch (e) {
      console.log(`  [${desc.index}] VID:${desc.vendorId} PID:${desc.productId} (erro ao ler detalhes)`)
    }
  })
  console.log('\nPara usar, configure PRINT_VID e PRINT_PID no .env ou variaveis de ambiente.')
} catch (e) {
  console.error('Erro ao listar dispositivos:', e.message)
}
