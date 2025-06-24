package com.appTest.store.services;

import com.appTest.store.dto.product.*;
import com.appTest.store.models.Material;
import com.appTest.store.repositories.IProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductService implements IProductService{

    @Autowired
    private IProductRepository repoProd;

    @Override
    public List<Material> getAllProducts() {
        return repoProd.findAll();
    }

    @Override
    public ProductDTO convertProductToDto(Material material) {
        int totalSales = (material.getSaleDetailList() != null) ? material.getSaleDetailList().size() : 0;

        return new ProductDTO(
                material.getBrand(),
                material.getName(),
                material.getPrice(),
                material.getQuantityAvailable(),
                totalSales
        );
    }

    @Override
    public Material getProductById(Long idProduct) {
        return repoProd.findById(idProduct).orElse(null);
    }

    @Override
    public List<ProductStockAlertDTO> getProductsWithLowStock() {
        return repoProd.getProductsWithLowStock();
    }

    @Override
    public ProductMostExpensiveDTO getProductByHighestPrice() {
        List<ProductMostExpensiveDTO> list = repoProd.getProductByHighestPrice();
        return list.isEmpty() ? null : list.get(0);
    }

    @Override
    public void createProduct(ProductCreateDTO dto) {
        Material material = new Material();
        material.setName(dto.getName());
        material.setBrand(dto.getBrand());
        material.setPrice(dto.getPrice());

        repoProd.save(material);
    }

    @Override
    public void updateProduct(ProductUpdateDTO dto) {
        Material material = repoProd.findById(dto.getIdProduct()).orElse(null);

        if (material != null) {
            if (dto.getName() != null) material.setName(dto.getName());
            if (dto.getBrand() != null) material.setBrand(dto.getBrand());
            if (dto.getPrice() != null) material.setPrice(dto.getPrice());
            if (dto.getQuantityAvailable() != null) material.setQuantityAvailable(dto.getQuantityAvailable());

            repoProd.save(material);
        }
    }

    @Override
    public boolean deleteProductById(Long idProduct) {
        Material material = repoProd.findById(idProduct).orElse(null);
        if (material != null) {
            repoProd.delete(material);
            return true;
        }
        return false;
    }

}
