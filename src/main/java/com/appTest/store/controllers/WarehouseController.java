package com.appTest.store.controllers;

import com.appTest.store.dto.warehouse.WarehouseCreateDTO;
import com.appTest.store.dto.warehouse.WarehouseDTO;
import com.appTest.store.dto.warehouse.WarehouseUpdateDTO;
import com.appTest.store.models.Warehouse;
import com.appTest.store.services.IWarehouseService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/warehouses")
public class WarehouseController {

    @Autowired
    private IWarehouseService servWare;

    @GetMapping
    public ResponseEntity<List<WarehouseDTO>> getAllWarehouses() {
        List<Warehouse> warehouseList = servWare.getAllWarehouses();

        List<WarehouseDTO> warehouseDTOList = warehouseList.stream()
                .map( warehouse -> servWare.convertWarehouseToDto(warehouse))
                .collect(Collectors.toList());

        return ResponseEntity.ok(warehouseDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WarehouseDTO> getWarehouseById(@PathVariable Long id) {
        Warehouse warehouse = servWare.getWarehouseById(id);
        if (warehouse == null) {
            return ResponseEntity.notFound().build();
        }
        WarehouseDTO warehouseDTO = servWare.convertWarehouseToDto(warehouse);

        return ResponseEntity.ok(warehouseDTO);
    }

    @PostMapping
    public ResponseEntity<WarehouseDTO> createWarehouse(@RequestBody @Valid WarehouseCreateDTO dto) {
        WarehouseDTO createdWarehouse = servWare.createWarehouse(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdWarehouse);
    }

    @PutMapping
    public ResponseEntity<WarehouseDTO> updateWarehouse(@RequestBody @Valid WarehouseUpdateDTO dto) {
        servWare.updateWarehouse(dto);
        Warehouse warehouse = servWare.getWarehouseById(dto.getIdWarehouse());
        return ResponseEntity.ok(servWare.convertWarehouseToDto(warehouse));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteWarehouseById(@PathVariable Long id) {
        Warehouse warehouse = servWare.getWarehouseById(id);

        if (warehouse != null) {
            servWare.deleteWarehouseById(id);
            return ResponseEntity.ok().body("The Warehouse has been successfully deleted.");
        }

        return ResponseEntity.notFound().build();
    }

}
