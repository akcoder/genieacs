"use strict";

import m from "mithril";

import config from "./config";
import filterComponent from "./filter-component";
import * as filterParser from "../common/filter-parser";

function load(filter, limit) {
  return new Promise((resolve, reject) => {
    m
      .request({
        url: "/api/devices/",
        data: { filter: filter, limit: limit }
      })
      .then(res => {
        resolve(res);
      })
      .catch(err => {
        err.message = err.message || "Unknown error";
        reject(err);
      });
  });
}

function count(filter, limit) {
  return new Promise((resolve, reject) => {
    function extract(xhr) {
      return +xhr.getResponseHeader("x-total-count");
    }
    m
      .request({
        method: "HEAD",
        url:
          "/api/devices/?" +
          m.buildQueryString({ filter: filter, limit: limit }),
        extract: extract
      })
      .then(res => {
        resolve(res);
      })
      .catch(err => {
        err.message = err.message || "Unknown error";
        reject(err);
      });
  });
}

function init(args) {
  return new Promise((resolve, reject) => {
    let filter;
    if (args.filter) filter = filterParser.parse(args.filter);

    Promise.all([count(args.filter), load(args.filter, config.pageSize)])
      .then(res => {
        resolve({ filter: filter, total: res[0], devices: res[1] });
      })
      .catch(reject);
  });
}

function renderTable(devices, parameters, total, showMoreCallback) {
  let labels = [];
  for (let param of parameters) labels.push(m("th", param.label));

  let rows = [];
  for (let device of devices)
    rows.push(
      m(
        "tr",
        parameters.map(p => {
          if (!device[p.parameter] || !device[p.parameter].value)
            return m("td.na");
          if (!device[p.parameter].value[0] === "") return m("td.blank");
          return m("td", device[p.parameter].value[0]);
        })
      )
    );

  let footerElements = [`${devices.length}/${total}`];

  if (devices.length < total)
    footerElements.push(m("a", { onclick: showMoreCallback }, "Show more"));

  let tfoot = m(
    "tfoot",
    m("tr", m("td", { colspan: labels.length }, footerElements))
  );

  return m("table.table", [
    m("thead", m("tr", labels)),
    m("tbody", rows),
    tfoot
  ]);
}

const component = {
  view: vnode => {
    document.title = "Devices - GenieACS";

    function showMore() {
      const lastDevice = vnode.attrs.devices[vnode.attrs.devices.length - 1];
      let f = filterParser.and(vnode.attrs.filter, [
        ">",
        "DeviceID.ID",
        lastDevice["DeviceID.ID"].value[0]
      ]);

      load(filterParser.stringify(f), config.pageSize).then(res => {
        vnode.attrs.devices = vnode.attrs.devices.concat(res);
        if (res.length < config.pageSize)
          vnode.attrs.total = vnode.attrs.devices.length;
      });
    }

    function onFilterChanged(filter) {
      let params = {};
      if (filter) params.filter = filterParser.stringify(filter);
      m.route.set("/devices", params);
    }

    return [
      m("h1", "Listing devices"),
      m(filterComponent, {
        filter: vnode.attrs.filter,
        onChange: onFilterChanged
      }),
      renderTable(
        vnode.attrs.devices,
        config.index,
        vnode.attrs.total,
        showMore
      )
    ];
  }
};

export { init, component };
