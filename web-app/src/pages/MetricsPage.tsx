import { useState, useEffect, useCallback } from 'react'
import { api, type ThermalAll, type BatteryDetail } from '../api'
import Card from '../components/Card'

function tempColor(c?: number) {
  if (c == null) return 'text-gray-500'
  if (c > 80) return 'text-red-500'
  if (c > 60) return 'text-amber-500'
  return 'text-green-500'
}

function ThermalRow({ label, value }: { label: string; value?: number }) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-bold ${tempColor(value)}`}>{value.toFixed(1)}°C</span>
    </div>
  )
}

function ThermalBar({ label, value, max = 100 }: { label: string; value?: number; max?: number }) {
  if (value == null) return null
  const pct = Math.min((value / max) * 100, 100)
  const color = value > 80 ? '#f87171' : value > 60 ? '#facc15' : '#4ade80'
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span style={{ color }}>{value.toFixed(1)}°C</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-slds-blue transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function MetricsPage() {
  const [thermal, setThermal] = useState<ThermalAll | null>(null)
  const [battery, setBattery] = useState<BatteryDetail | null>(null)

  const fetchAll = useCallback(async () => {
    const [t, b] = await Promise.allSettled([api.thermalAll(), api.batteryDetail()])
    if (t.status === 'fulfilled') setThermal(t.value)
    if (b.status === 'fulfilled') setBattery(b.value)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 3000)
    return () => clearInterval(id)
  }, [fetchAll])

  function formatTime(secs: number) {
    if (secs <= 0) return '—'
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const cpuAvg = thermal && thermal.cpu_0 != null
    ? [thermal.cpu_0, thermal.cpu_1, thermal.cpu_2, thermal.cpu_3].filter((v): v is number => v != null).reduce((a, b) => a + b, 0)
      / [thermal.cpu_0, thermal.cpu_1, thermal.cpu_2, thermal.cpu_3].filter(v => v != null).length
    : undefined

  const batteryHealth = battery && battery.charge_full_design_mah > 0
    ? Math.round((battery.charge_full_mah / battery.charge_full_design_mah) * 100)
    : undefined

  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Metrics</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Temperatures">
          {thermal ? (
            <div className="space-y-2.5">
              <ThermalBar label="CPU (avg)" value={cpuAvg} />
              <ThermalBar label="Modem (Q6 DSP)" value={thermal.modem} />
              <ThermalBar label="Modem SS" value={thermal.modem_ss0} />
              <ThermalBar label="PA (Power Amplifier)" value={thermal.pa} />
              <ThermalBar label="SDR (Radio)" value={thermal.sdr} />
              <ThermalBar label="Battery" value={thermal.battery} />
              <ThermalBar label="USB" value={thermal.usb} />
              <ThermalBar label="Ethernet PHY" value={thermal.eth_phy} />
              <ThermalBar label="PMIC" value={thermal.pmic} />
              <ThermalBar label="Board (XO)" value={thermal.xo_therm} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </Card>

        <Card title="CPU Cores">
          {thermal ? (
            <div className="space-y-1.5">
              <ThermalRow label="Core 0" value={thermal.cpu_0} />
              <ThermalRow label="Core 1" value={thermal.cpu_1} />
              <ThermalRow label="Core 2" value={thermal.cpu_2} />
              <ThermalRow label="Core 3" value={thermal.cpu_3} />
              <div className="border-t border-gray-200/60 pt-1.5">
                <ThermalRow label="Average" value={cpuAvg} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </Card>

        <Card title="Battery">
          {battery ? (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-gray-900">{battery.capacity}%</span>
                  <span className="text-gray-500">{battery.status}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slds-blue transition-all duration-500" style={{
                    width: `${battery.capacity}%`,
                  }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Power</p>
                  <p className="font-medium text-gray-900">{(battery.power_mw / 1000).toFixed(2)} W</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Voltage</p>
                  <p className="text-gray-900">{(battery.voltage_mv / 1000).toFixed(3)} V</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current</p>
                  <p className="text-gray-900">{battery.current_ma} mA</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Charge Type</p>
                  <p className="text-gray-900">{battery.charge_type || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Temperature</p>
                  <p className={tempColor(battery.temperature_c)}>{battery.temperature_c.toFixed(1)}°C</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{battery.status === 'Charging' ? 'Time to Full' : 'Time to Empty'}</p>
                  <p className="text-gray-900">{formatTime(battery.status === 'Charging' ? battery.time_to_full_secs : battery.time_to_empty_secs)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </Card>

        <Card title="Battery Health">
          {battery ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Health</span>
                <span className="text-gray-900">{battery.health}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Capacity</span>
                <span className="text-gray-900">{battery.charge_full_mah} / {battery.charge_full_design_mah} mAh</span>
              </div>
              {batteryHealth != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity Retention</span>
                  <span className={batteryHealth > 80 ? 'text-green-500' : 'text-amber-500'}>{batteryHealth}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Cycle Count</span>
                <span className="text-gray-900">{battery.cycle_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">OCV</span>
                <span className="text-gray-900">{(battery.voltage_ocv_mv / 1000).toFixed(3)} V</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </Card>
      </div>
    </div>
  )
}
