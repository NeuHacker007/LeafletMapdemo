import {Component, OnDestroy, OnInit} from '@angular/core';
import * as L from 'leaflet';
import geojsonvt from 'geojson-vt';
import '../../node_modules/leaflet-canvas-marker-labinno/dist/leaflet.canvas-markers';
import '../../node_modules/leaflet.motion/dist/leaflet.motion.min';
import '../../node_modules/leaflet-textpath/leaflet.textpath'
import {AsimsAcarsService, AsimsAirportsService, AsimsVdlService} from "./MapServices";
import {Subscription} from "rxjs";
import {FlightRouteService} from "./FlightDataServices";
import {IFlightRoute} from "./FlightData";

const NAUTICAL_MILE_PER_METER = 0.000539957;
const CIRCLE_RADIUS_IN_NATUTICALMILE = 200;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  private leafletMap: L.Map;
  private acarStationGeoJsonData;
  private airportGeoJsonData;
  private vdlGeoJsonData;
  private acarstationLayer;
  private acarstationGeoLayers: L.Layer[];
  private airportLayer;
  private airportGeoLayers: L.Layer[];
  private vdlstationLayer;
  private vdlstationGeoLayers: L.Layer[];
  private acarMarkers: L.Marker[] = [];
  private airportMarkers: L.Marker[] = [];
  private vdlMarkers: L.Marker[] = [];
  private canvasmarkerLayers;
  private acarStationCircleTracker: Map<number[], L.Circle> = new Map<number[], L.Circle>();
  private acarStationMarkerTracker: Map<number[], L.Circle> = new Map<number[], L.Circle>();
  private airportCircleTracker: Map<number[], L.Circle> = new Map<number[], L.Circle>();
  private airportMarkerTracker: Map<number[], L.Circle> = new Map<number[], L.Circle>();
  private vdlStationCircleTracker: Map<number[], L.Circle> = new Map<number[], L.Circle>();
  private vdlStationMarkerTracker: Map<number[], L.Circle> = new Map<number[], L.Circle>();
  private isAcarStationOnMap: boolean = false;
  private isAirportOnMap: boolean = false;
  private isVdlStationOnMap: boolean = false;
  private flightRoutes: Array<IFlightRoute> = [];


  private geojsonvtOption = {
    maxZoom: 20,  // max zoom to preserve detail on; can't be higher than 24
    tolerance: 3, // simplification tolerance (higher means simpler)
    extent: 4096, // tile extent (both width and height)
    buffer: 64,   // tile buffer on each side
    debug: 0,     // logging level (0 to disable, 1 or 2)
    lineMetrics: false, // whether to enable line metrics tracking for LineString/MultiLineString features
    promoteId: null,    // name of a feature property to promote to feature.id. Cannot be used with `generateId`
    generateId: false,  // whether to generate feature ids. Cannot be used with `promoteId`
    indexMaxZoom: 5,       // max zoom in the initial tile index
    indexMaxPoints: 1000 // max number of points per tile in the index

  }
  private acarStationMakerOption = {
    icon: new L.Icon({
      iconUrl: '../assets/broadcast-tower-solid.svg',
      iconSize: [24, 24],
      iconAnchor: [10, 9]
    })
  };
  private airportMakerOption = {
    icon: new L.Icon({
      iconUrl: '../assets/Airport_symbol.svg',
      iconSize: [24, 24],
      // To make the leaflet canvas marker working properly, we had to provide icon anchor
      iconAnchor: [10, 9]
    })
  };
  private vdlStationMakerOption = {
    icon: new L.Icon({
      iconUrl: '../assets/building-solid.svg',
      iconSize: [24, 24],
      // To make the leaflet canvas marker working properly, we had to provide icon anchor
      iconAnchor: [10, 9]
    })
  };
  private readonly acarStationSubscription: Subscription;
  private readonly airportSubscription: Subscription;
  private readonly vdlStationSubscription: Subscription;
  private readonly flightRoutesSubscription: Subscription;
  private readonly LAYER_OSM = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 13,
    attribution: 'Open Street Map'
  });
  public layers: L.Layer[] = [];
  public layersControl = {
    baseLayers: {
      'Open Street Map': this.LAYER_OSM
    },
    overlays: {}
  };
  public options = {
    zoom: 13,
    center: L.latLng(39.1696, -76.6786),
    perferCanvas: true
  };

  constructor(
    private acarsDataService: AsimsAcarsService,
    private airportDataService: AsimsAirportsService,
    private vdlDataService: AsimsVdlService,
    private flightRouteService: FlightRouteService
  ) {

    this.acarStationSubscription = this.acarsDataService.getData().subscribe((result) => {
      if (result) {
        this.acarStationGeoJsonData = result;
      } else {
        console.log('emitted acar station data is not valid');
      }
    });
    this.airportSubscription = this.airportDataService.getData().subscribe((result) => {
      if (result) {
        this.airportGeoJsonData = result;
      } else {
        console.log('emitted airport station data is not valid');
      }

    });
    this.vdlStationSubscription = this.vdlDataService.getData().subscribe((result) => {
      if (result) {
        this.vdlGeoJsonData = result;
      } else {
        console.log('emitted vdl station data is not valid');
      }
    });
    this.flightRoutesSubscription = this.flightRouteService.getFlightRouteData().subscribe((result) => {
      if (result) {
        this.flightRoutes = result;
      }
    });
  }

  public ngOnInit(): void {
    this.apply();
  }

  public ngOnDestroy(): void {
    if (this.acarStationSubscription) {
      this.acarStationSubscription.unsubscribe();
    }
    if (this.airportSubscription) {
      this.airportSubscription.unsubscribe();
    }
    if (this.vdlStationSubscription) {
      this.vdlStationSubscription.unsubscribe();
    }
    if (this.flightRoutesSubscription) {
      this.flightRoutesSubscription.unsubscribe();
    }
    if (this.acarMarkers.length > 0) {
      this.acarMarkers = [];
    }
    if (this.airportMarkers.length > 0) {
      this.airportMarkers = [];
    }
    if (this.vdlMarkers.length > 0) {
      this.vdlMarkers = [];
    }
  }

  public enableToolTip(event: MouseEvent) {
    // if (this.acarstationLayer && this.leafletMap && this.leafletMap.hasLayer(this.acarstationLayer)) {
    //   this.acarstationLayer.eachLayer((layer: L.Layer) => {
    //     if (!layer.isTooltipOpen()) {
    //       layer.openTooltip();
    //     }
    //   });
    // }
    // if (this.airportLayer && this.leafletMap && this.leafletMap.hasLayer(this.airportLayer)) {
    //   this.acarstationLayer.eachLayer((layer: L.Layer) => {
    //     if (!layer.isTooltipOpen()) {
    //       layer.openTooltip();
    //     }
    //   });
    // }
    // if (this.vdlstationLayer && this.leafletMap && this.leafletMap.hasLayer(this.vdlstationLayer)) {
    //   this.vdlstationLayer.eachLayer((layer: L.Layer) => {
    //     if (!layer.isTooltipOpen()) {
    //       layer.openTooltip();
    //     }
    //   });
    // }
  }

  public disableToolTip(event: MouseEvent) {
    // if (this.acarstationLayer && this.leafletMap && this.leafletMap.hasLayer(this.acarstationLayer)) {
    //   this.acarstationLayer.eachLayer((layer: L.Layer) => {
    //     if (layer.isTooltipOpen()) {
    //       layer.closeTooltip();
    //     }
    //   });
    // }
    // if (this.airportLayer && this.leafletMap && this.leafletMap.hasLayer(this.airportLayer)) {
    //   this.acarstationLayer.eachLayer((layer: L.Layer) => {
    //     if (layer.isTooltipOpen()) {
    //       layer.closeTooltip();
    //     }
    //   });
    // }
    // if (this.vdlstationLayer && this.leafletMap && this.leafletMap.hasLayer(this.vdlstationLayer)) {
    //   this.vdlstationLayer.eachLayer((layer: L.Layer) => {
    //     if (layer.isTooltipOpen()) {
    //       layer.closeTooltip();
    //     }
    //   });
    // }
  }

  public drawAcarStationCircle(event: MouseEvent): void {
    if (this.isAcarStationOnMap && this.acarMarkers.length > 0) {
      this.acarMarkers.forEach((marker: L.Marker) => {
        const circle: L.Circle = L.circle(marker._latlng,
          {
            radius: CIRCLE_RADIUS_IN_NATUTICALMILE / NAUTICAL_MILE_PER_METER,
            color: '#ff6666',
            dashArray: '10',
            fill: false
          }
        ).addTo(this.leafletMap)
        this.acarStationCircleTracker.set(marker._latlng, circle);
      });

    } else {
      alert('Acar layer is not active')
    }
    console.log(event);
  }

  public drawAirportCircle(event: MouseEvent): void {
    if (this.isAirportOnMap && this.airportMarkers.length > 0) {
      this.airportMarkers.forEach((marker: L.Marker) => {
        const circle: L.Circle = L.circle(marker._latlng,
          {
            radius: CIRCLE_RADIUS_IN_NATUTICALMILE / NAUTICAL_MILE_PER_METER,
            color: 'gray',
            dashArray: '10',
            fill: false
          }
        ).addTo(this.leafletMap)
        this.airportCircleTracker.set(marker._latlng, circle);
      });

    } else {
      alert('airport layer is not active')
    }
  }

  public drawVdlStationCircle(event: MouseEvent): void {
    if (this.isVdlStationOnMap && this.vdlMarkers.length > 0) {
      this.vdlMarkers.forEach((marker: L.Marker) => {
        const circle: L.Circle = L.circle(marker._latlng,
          {
            radius: CIRCLE_RADIUS_IN_NATUTICALMILE / NAUTICAL_MILE_PER_METER,
            color: 'red',
            dashArray: '10',
            fill: false
          }
        ).addTo(this.leafletMap)
        this.vdlStationCircleTracker.set(marker._latlng, circle);
      });

    } else {
      alert('vdl station layer is not active')
    }
  }

  public addAcarStationLayer(event: MouseEvent): void {

    this.canvasmarkerLayers.addLayers(this.acarMarkers);
    this.isAcarStationOnMap = true;
  }

  public addAirportStationLayer(event: MouseEvent): void {
    this.canvasmarkerLayers.addLayers(this.airportMarkers);
    this.isAirportOnMap = true;
  }

  public addVdlStationLayer(event: MouseEvent): void {
    this.canvasmarkerLayers.addLayers(this.vdlMarkers);
    this.isVdlStationOnMap = true;
  }

  public removeAcarStationLayer(event: MouseEvent) {
    this.acarMarkers.forEach((marker: L.Marker) => {
      marker.closePopup();
      marker.closeTooltip();
        this.canvasmarkerLayers.removeMarker(marker, true);
      }
    );
    this.isAcarStationOnMap = false;
    if (this.leafletMap && this.acarStationCircleTracker.size > 0) {
      this.acarStationCircleTracker.forEach((value, key) => {
        this.leafletMap.removeLayer(value);
      });
      this.acarStationCircleTracker.clear();
    }
  }

  public removeAirportStationLayer(event: MouseEvent) {
    this.airportMarkers.forEach((marker: L.Marker) => {
      marker.closePopup();
      marker.closeTooltip();
        this.canvasmarkerLayers.removeMarker(marker, true);
      }
    );
    this.isAirportOnMap = false;
    if (this.leafletMap && this.airportCircleTracker.size > 0) {
      this.airportCircleTracker.forEach((value, key) => {
        this.leafletMap.removeLayer(value);
      });
      this.airportCircleTracker.clear();
    }
  }

  public removeVdlStationLayer(event: MouseEvent) {
    this.vdlMarkers.forEach((marker) => {
        this.canvasmarkerLayers.removeMarker(marker, true);
      }
    );
    this.isVdlStationOnMap = false;
    if (this.leafletMap && this.vdlStationCircleTracker.size > 0) {
      this.vdlStationCircleTracker.forEach((value, key) => {
        this.leafletMap.removeLayer(value);
      });
      this.vdlStationCircleTracker.clear();
    }
  }

  public drawFlightRoute(event: MouseEvent) {
    const seqGroup = L.motion.seq([
      L.motion.polyline([this.flightRoutes[0].wayPoints[0].coords, this.flightRoutes[0].wayPoints[1].coords, this.flightRoutes[0].wayPoints[2].coords], {
          color: 'indigo'
        },
        {
          speed: this.flightRoutes[0].speed
        },
        {
          removeOnEnd: true,
          icon: L.divIcon({
            html: "<i class='airpline-solid' aria-hidden='true' motion-base='-45'></i>",
            iconSize: L.point(24, 24)
          })
        })
    ]).addTo(this.leafletMap);
    seqGroup.motionStart();
  }

  public onMapReady(map: L.Map): void {
    this.leafletMap = map ? map : undefined;
    const tileindex = geojsonvt(this.acarStationGeoJsonData, this.geojsonvtOption);
    //this.leafletMap.setView([39.1696, -76.6786], 13);

    this.setAcarStationLayerFromGeoJson();
    this.setAirportLayerFromGeoJson();
    this.setVdlStationLayerFromGeoJson();
    this.canvasmarkerLayers = L.canvasIconLayer({}).addTo(this.leafletMap);
    this.canvasmarkerLayers.addLayer(new L.Marker([0, 0], {
      icon: new L.Icon({
        iconUrl: '',
        iconSize: [0, 0],
        // To make the leaflet canvas marker working properly, we had to provide icon anchor
        iconAnchor: [0, 0]
      })
    }));

  }
  private setAcarStationLayerFromGeoJson(): void {
    this.acarstationGeoLayers = L.geoJSON(this.acarStationGeoJsonData, {
        pointToLayer: (geoJsonPoint, latlng): L.Layer => {
          const marker = new L.Marker(latlng, this.acarStationMakerOption).bindTooltip(
            geoJsonPoint.properties.iata,
            {
              permanent: true,
              offset: L.point(30, 30)
            });
          this.acarMarkers.unshift(marker);
          return marker;
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties
            && feature.properties.iata
            && feature.properties.frequency
          ) {
            const message = `
            I am an Acar station <br>
            IATA Code: ${feature.properties.iata} <br>
            Frequency: ${feature.properties.frequency}
            `;
            layer.bindPopup(message);
          }
        }
      }
    );
  }

  private setAirportLayerFromGeoJson(): void {
    this.airportGeoLayers = L.geoJSON(this.airportGeoJsonData, {
        pointToLayer: (geoJsonPoint, latlng): L.Layer => {
          const marker = new L.Marker(latlng, this.airportMakerOption).bindTooltip(
            geoJsonPoint.properties.iata,
            {
              permanent: true,
              offset: L.point(30, 30)
            });
          this.airportMarkers.unshift(marker);
          return marker;
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties
            && feature.properties.iata
            && feature.properties.numberOfVHFStations
            && feature.properties.airport
            && feature.properties.city
            && feature.properties.state
            && feature.properties.country
          ) {
            const message = `
            I am an Airport <br>
            Airport Name: ${feature.properties.airport} <br>
            IATA Code: ${feature.properties.iata} <br>
            Num of VHF Station: ${feature.properties.numberOfVHFStations} <br>
            City: ${feature.properties.city} <br>
            State: ${feature.properties.state} <br>
            Country: ${feature.properties.country} 
            `;
            layer.bindPopup(message);
          }
        }
      }
    );
  }

  private setVdlStationLayerFromGeoJson(): void {
    this.vdlstationGeoLayers = L.geoJSON(this.vdlGeoJsonData, {
        pointToLayer: (geoJsonPoint, latlng): L.Layer => {
          const marker = new L.Marker(latlng, this.vdlStationMakerOption).bindTooltip(
            geoJsonPoint.properties.iata,
            {
              permanent: true,
              offset: L.point(30, 30)
            })
          this.vdlMarkers.unshift(marker);
          return marker;
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties
            && feature.properties.iata
            && feature.properties.frequency
          ) {
            const message = `
            I am an Vdl station <br>
            IATA Code: ${feature.properties.iata} <br>
            Frequency: ${feature.properties.frequency}
            `;
            layer.bindPopup(message);
          }
        }
      }
    );
  }

  private apply(): boolean {
    this.layers.push(this.LAYER_OSM);
    return false;
  }
}
