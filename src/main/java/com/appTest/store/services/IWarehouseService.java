package com.appTest.store.services;

import com.appTest.store.dto.warehouse.WarehouseCreateDTO;
import com.appTest.store.dto.warehouse.WarehouseDTO;
import com.appTest.store.dto.warehouse.WarehouseUpdateDTO;
import com.appTest.store.models.Warehouse;

import java.util.List;

public interface IWarehouseService {
    List<Warehouse> getAllWarehouses();
    Warehouse getWarehouseById(Long id);
    WarehouseDTO convertWarehouseToDto(Warehouse warehouse);
    WarehouseDTO createWarehouse(WarehouseCreateDTO dto);
    void updateWarehouse(WarehouseUpdateDTO dto);
    void deleteWarehouseById(Long id);
}
