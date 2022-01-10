import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BleClient, numbersToDataView, numberToUUID } from '@capacitor-community/bluetooth-le';
import './App.css';

const formDataTemplate = {
  "first name": '',
  "last name": '',
  "age": ''
}

const USER_DATA_SERVICE = numberToUUID(0x181C)
const USER_DATA_FIRST_NAME_CHARACTERISTIC = numberToUUID(0x2A8A)
const USER_DATA_LAST_NAME_CHARACTERISTIC = numberToUUID(0x2A90)
const USER_DATA_AGE_CHARACTERISTIC = numberToUUID(0x2A80)

const Loader = ({ isShow = false, text = 'Loading...'}) => (
  <>
    {
      isShow ? <div className="loader">{text}</div> : ''
    }
  </>    
)

function App() {

  const decoder = useMemo(() => new TextDecoder(), [])
  const encoder = useMemo(() => new TextEncoder(), [])

  const [ formData, setFormData ] = useState(formDataTemplate)
  const [ devices, setDevices ] = useState([])
  const [ selectedDevice, setSelectedDevice ] = useState(null)
  const [ error, setError] = useState(null)

  const [ loadingDevice, setLoadingDevice ] = useState(false)
  const [ loading, setLoading ] = useState(false)

  useEffect(() => {
    if(error) {
      alert(error)
      setError(null)
    }
  }, [error])

  const isSubmitActive = useMemo(() => {
    return !(selectedDevice && Object.values(formData).every(v => v))
  }, [formData, selectedDevice])


  const handleDeviceLoad = async () => {
    if(!loading) {
      setDevices([])
      setSelectedDevice(null)
      const temp = []
      try {
        await BleClient.initialize();
        console.log('UNIQUE_ requesting devices... ');

        setLoading(true)

        await BleClient.requestLEScan({},
          (result) => {
            console.log('UNIQUE_ received new scan result: ', JSON.stringify(result, null, 2) );
            temp.push(result);
          }
        );
    
        setTimeout(async () => {
          await BleClient.stopLEScan();
          setLoading(false)
          setDevices([...temp])
          console.log('UNIQUE_  stopped scanning'); 
        }, 5000);
      } catch (err) {
        setLoading(false)
        console.error('UNIQUE_ ERROR', JSON.stringify(err, null, 2));
        setError(err)
      }
    }
  }
  
  const handleDeviceSelect = useCallback(async (item) => {
    setSelectedDevice(item)
    try {
      if (selectedDevice) {
        console.log(`UNIQUE_ disconnecting from device ${selectedDevice.device.deviceId}...` )
        await BleClient.disconnect(selectedDevice.device.deviceId);
        console.log('UNIQUE_ disconnected from device ', selectedDevice.device.deviceId)
      }
      console.log('UNIQUE_ Connecting to device', item.device.deviceId);
      setLoadingDevice(true)
      setFormData(formDataTemplate)
      await BleClient.connect(item.device.deviceId, (deviceId) => console.log('UNIQUE_ disconnected to device', deviceId));
      console.log('UNIQUE_ connected to device', item.device.deviceId);

      console.log(`UNIQUE_ Requesting User Data from device ${item.device.deviceId} ...`);

      await Promise.all([
        BleClient.read(item.device.deviceId, USER_DATA_SERVICE, USER_DATA_FIRST_NAME_CHARACTERISTIC),
        BleClient.read(item.device.deviceId, USER_DATA_SERVICE, USER_DATA_LAST_NAME_CHARACTERISTIC),
        BleClient.read(item.device.deviceId, USER_DATA_SERVICE, USER_DATA_AGE_CHARACTERISTIC),
      ]).then(([ fname, lname, age ]) => {
        setFormData({
          "first name": decoder.decode(fname),
          "last name":  decoder.decode(lname),
          "age":        decoder.decode(age),
        })
      }).finally(() => setLoadingDevice(false))

      console.log(`UNIQUE_ Requesting User Data from device ${item.device.deviceId} is finished.`);

    } catch(err) {
      setLoadingDevice(false)
      setError(err)
    }

  }, [ decoder, selectedDevice ])

  const handleFormData = useCallback((e) => setFormData({...formData, [e.target.name]: e.target.value}), [formData])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    try{
      setLoadingDevice(true)

      console.log("UNIQUE_ Writing process...")

      await BleClient.write(selectedDevice.device.deviceId, USER_DATA_SERVICE, USER_DATA_FIRST_NAME_CHARACTERISTIC, numbersToDataView(encoder.encode(formData["first name"])));
      await BleClient.write(selectedDevice.device.deviceId, USER_DATA_SERVICE, USER_DATA_LAST_NAME_CHARACTERISTIC, numbersToDataView(encoder.encode(formData["last name"])));
      await BleClient.write(selectedDevice.device.deviceId, USER_DATA_SERVICE, USER_DATA_AGE_CHARACTERISTIC, numbersToDataView(encoder.encode(formData["age"])));

      console.log("UNIQUE_ Writing process is finished.")

      setLoadingDevice(false)
     
    } catch(err) {
      setLoadingDevice(false)
      setError(err)
    }
  }, [ selectedDevice, formData, decoder, encoder ])

  return (
    <div className="App">
      <div className="form-container">
        <div className="application-form-container">
          <form className="application-form" onSubmit={handleSubmit}>
            <div className="input-container">
              {
                Object.keys(formDataTemplate).map((key, i) => (
                  <label key={`${key}${i}`}>
                    <span>{`${key[0].toUpperCase()}${key.slice(1, key.length)}:`}</span>
                    <input type="text" name={key} onChange={handleFormData} value={formData[key]}/><div></div>
                  </label>
                ))
              }
            </div>
            <input type="submit" value="Submit" disabled={isSubmitActive}/>
          </form>

          <Loader isShow={loadingDevice} text={'Loading device data...'} />
        </div>

        <div className="devices-list-container">
          <button onClick={handleDeviceLoad} disabled={loading}>Check Devices</button>
          <div className="devices-list">
            {
              devices.map((device) => (
                <div key={device.device.deviceId} className={`device-list-item ${selectedDevice && selectedDevice.device.deviceId === device.device.deviceId ? 'selected-device' : ''}`} onClick={() => handleDeviceSelect(device)}>
                  {device.device.name ? (<span>{device.device.name}</span>) : ''}
                  {device.device.deviceId ? (<span>{device.device.deviceId}</span>) : ''}
                </div>
              ))
            }
          </div>
          <Loader isShow={loading}/>
        </div>
      </div>
    </div>
  );
}

export default App;
