package com.chetanwanave.todo.controller;

import com.chetanwanave.todo.dto.ExportResponse;
import com.chetanwanave.todo.dto.ImportRequest;
import com.chetanwanave.todo.dto.ImportResult;
import com.chetanwanave.todo.service.ImportExportService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class DataController {

    private final ImportExportService importExportService;

    public DataController(ImportExportService importExportService) {
        this.importExportService = importExportService;
    }

    @GetMapping("/export")
    public ExportResponse export() {
        return importExportService.export();
    }

    @PostMapping("/import")
    public ImportResult importData(@Valid @RequestBody ImportRequest request) {
        return importExportService.importData(request);
    }
}
