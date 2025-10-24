package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.warehouse.WarehouseCreateDTO;
import com.appTest.store.dto.warehouse.WarehouseDTO;
import com.appTest.store.dto.warehouse.WarehouseUpdateDTO;
import com.appTest.store.models.Stock;
import com.appTest.store.models.Warehouse;
import com.appTest.store.repositories.IWarehouseRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class WarehouseService implements IWarehouseService{

    @Autowired
    private IWarehouseRepository repoWare;

    @Override
    public List<Warehouse> getAllWarehouses() {
        return repoWare.findAll();
    }

    @Override
    public Warehouse getWarehouseById(Long id) {
        return repoWare.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Warehouse not found with ID: " + id));
    }

    @Override
    public WarehouseDTO convertWarehouseToDto(Warehouse warehouse) {

        BigDecimal totalStock = warehouse.getStockList().stream()
                .map(Stock::getQuantityAvailable)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new WarehouseDTO(
                warehouse.getIdWarehouse(),
                warehouse.getAddress(),
                warehouse.getName(),
                warehouse.getLocation(),
                totalStock
        );
    }

    @Override
    @Transactional
    @Auditable(action="WAREHOUSE_CREATE", entity="Supplier")
    public WarehouseDTO createWarehouse(WarehouseCreateDTO dto) {
        Warehouse warehouse = new Warehouse();
        warehouse.setAddress(dto.getAddress());
        warehouse.setName(dto.getName());
        warehouse.setLocation(dto.getLocation());
        repoWare.save(warehouse);
        return convertWarehouseToDto(warehouse);
    }

    @Override
    @Transactional
    @Auditable(entity="Warehouse", action="UPDATE", idParam="dto.idWarehouse")
    public void updateWarehouse(WarehouseUpdateDTO dto) {
        Warehouse warehouse = repoWare.findById(dto.getIdWarehouse())
                .orElseThrow(() -> new EntityNotFoundException("Warehouse not found with ID: " + dto.getIdWarehouse()));

        if (dto.getAddress() != null) warehouse.setAddress(dto.getAddress());
        if (dto.getName() != null) warehouse.setName(dto.getName());
        if (dto.getLocation() != null) warehouse.setLocation(dto.getLocation());

        repoWare.save(warehouse);
    }

    @Override
    @Transactional
    @Auditable(entity="Warehouse", action="DELETE", idParam="id")
    public void deleteWarehouseById(Long id) {
        repoWare.deleteById(id);
    }
}
